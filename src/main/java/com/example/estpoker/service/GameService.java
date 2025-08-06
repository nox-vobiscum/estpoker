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

@Service
public class GameService {

    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final Map<WebSocketSession, Room> sessionToRoomMap = new ConcurrentHashMap<>();
    private final Map<WebSocketSession, String> sessionToParticipantMap = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public Room getOrCreateRoom(String roomCode) {
        return rooms.computeIfAbsent(roomCode, Room::new);
    }

    public Room getRoom(String roomCode) {
        return rooms.get(roomCode);
    }

    public void addSession(WebSocketSession session, Room room) {
        sessionToRoomMap.put(session, room);
    }

    public void trackParticipant(WebSocketSession session, String participantName) {
        sessionToParticipantMap.put(session, participantName);
    }

    public Room getRoomForSession(WebSocketSession session) {
        return sessionToRoomMap.get(session);
    }

    public String getParticipantName(WebSocketSession session) {
        return sessionToParticipantMap.get(session);
    }

    public void removeSession(WebSocketSession session) {
        sessionToRoomMap.remove(session);
        sessionToParticipantMap.remove(session);
    }

    public void revealCards(String roomCode) {
        Room room = rooms.get(roomCode);
        if (room != null) {
            room.setCardsRevealed(true);
        }
    }

    public void resetVotes(String roomCode) {
        Room room = rooms.get(roomCode);
        if (room != null) {
            room.reset();
        }
    }

    public Optional<Double> calculateAverageVote(Room room) {
        return room.getParticipants().stream()
                .map(Participant::getVote)
                .filter(v -> v != null && v.matches("\\d+"))
                .mapToInt(Integer::parseInt)
                .average()
                .stream()
                .boxed()
                .findFirst();
    }

    public void broadcastToRoom(Room room, String message) {
        sessionToRoomMap.entrySet().removeIf(entry -> {
            WebSocketSession session = entry.getKey();
            if (!entry.getValue().equals(room)) return false;

            try {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage(message));
                    return false;
                } else {
                    return true;
                }
            } catch (IOException e) {
                e.printStackTrace();
                return true;
            }
        });
    }

    public void broadcastRoomState(Room room) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "voteUpdate");

            List<Map<String, Object>> participants = new ArrayList<>();
            for (Participant p : room.getParticipants()) {
                Map<String, Object> pData = new HashMap<>();
                pData.put("name", p.getName());
                pData.put("vote", p.getVote());
                pData.put("active", p.isActive());
                pData.put("disconnected", p.isDisconnected());
                participants.add(pData);
            }

            payload.put("participants", participants);
            payload.put("votesRevealed", room.areVotesRevealed());

            Optional<Double> avg = calculateAverageVote(room);
            payload.put("averageVote", room.areVotesRevealed()
                    ? avg.map(a -> String.format("%.1f", a)).orElse("N/A")
                    : null);

            String json = objectMapper.writeValueAsString(payload);
            broadcastToRoom(room, json);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
