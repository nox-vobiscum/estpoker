package com.example.estpoker.service;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class GameService {

    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final Map<WebSocketSession, Room> sessionToRoomMap = new ConcurrentHashMap<>();
    private final List<WebSocketSession> sessions = new CopyOnWriteArrayList<>();

    public Room getOrCreateRoom(String roomCode) {
        return rooms.computeIfAbsent(roomCode, Room::new);
    }

    public Room getRoom(String roomCode) {
        return rooms.get(roomCode);
    }

    public Room getRoomFromSession(WebSocketSession session) {
        return sessionToRoomMap.get(session);
    }

    public void assignSessionToRoom(WebSocketSession session, String roomCode) {
        Room room = getOrCreateRoom(roomCode);
        sessionToRoomMap.put(session, room);
    }

    public void storeCardValue(WebSocketSession session, String participantName, String cardValue) {
        Room room = getRoomFromSession(session);
        if (room != null) {
            room.storeCardValue(participantName, cardValue);
        }
    }

    public Optional<Double> calculateAverageVote(Room room) {
        OptionalDouble avg = room.getParticipants().stream()
                .map(Participant::getVote)
                .filter(v -> v != null && v.matches("\\d+"))
                .mapToInt(Integer::parseInt)
                .average();

        return avg.isPresent() ? Optional.of(avg.getAsDouble()) : Optional.empty();
    }

    public void revealCards(String roomCode) {
        Room room = getRoom(roomCode);
        if (room != null) {
            room.revealVotes();
        }
    }

    public void resetVotes(String roomCode) {
        Room room = getRoom(roomCode);
        if (room != null) {
            room.resetVotes();
        }
    }

    public String buildVoteUpdateJson(Room room) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "voteUpdate");

            List<Map<String, String>> participantList = new ArrayList<>();
            for (Participant p : room.getParticipants()) {
                Map<String, String> pData = new HashMap<>();
                pData.put("name", p.getName());
                pData.put("vote", p.getVote());
                participantList.add(pData);
            }
            payload.put("participants", participantList);

            if (room.areVotesRevealed()) {
                Optional<Double> avg = calculateAverageVote(room);
                payload.put("averageVote", avg.map(a -> String.format("%.1f", a)).orElse("N/A"));
            } else {
                payload.put("averageVote", null);
            }

            payload.put("votesRevealed", room.areVotesRevealed());

            ObjectMapper mapper = new ObjectMapper();
            return mapper.writeValueAsString(payload);
        } catch (Exception e) {
            e.printStackTrace();
            return "{}";
        }
    }

    public String buildRevealJson(Room room) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "reveal");

            List<Map<String, String>> participantList = new ArrayList<>();
            for (Participant p : room.getParticipants()) {
                Map<String, String> pData = new HashMap<>();
                pData.put("name", p.getName());
                pData.put("vote", p.getVote());
                participantList.add(pData);
            }
            payload.put("participants", participantList);

            Optional<Double> avg = calculateAverageVote(room);
            payload.put("averageVote", avg.map(a -> String.format("%.1f", a)).orElse("N/A"));

            ObjectMapper mapper = new ObjectMapper();
            return mapper.writeValueAsString(payload);
        } catch (Exception e) {
            e.printStackTrace();
            return "{}";
        }
    }

    public void registerSession(WebSocketSession session) {
        sessions.add(session);
    }

    public void removeSession(WebSocketSession session) {
        sessions.remove(session);
        sessionToRoomMap.remove(session);
    }

    public void broadcastToRoom(Room room, String message) {
        sessionToRoomMap.entrySet().stream()
                .filter(entry -> entry.getValue().equals(room))
                .map(Map.Entry::getKey)
                .forEach(session -> {
                    try {
                        session.sendMessage(new TextMessage(message));
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                });
    }
}
