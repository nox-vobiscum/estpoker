package com.example.estpoker.service;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.TextMessage;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Optional;
import java.util.OptionalDouble;

@Service
public class GameService {

    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final Map<WebSocketSession, Room> sessionToRoomMap = new ConcurrentHashMap<>();

    public Room getOrCreateRoom(String roomCode) {
        return rooms.computeIfAbsent(roomCode, Room::new);
    }

    public Room getRoom(String roomCode) {
        return rooms.get(roomCode);
    }

    public Room getRoomFromSession(WebSocketSession session) {
        return sessionToRoomMap.get(session);
    }

    public void storeCardValue(WebSocketSession session, String participantName, String cardValue) {
        Room room = getRoomFromSession(session);
        if (room != null) {
            room.storeCardValue(participantName, cardValue);
        }
    }

    public void broadcastToAllSessions(String message) {
        sessionToRoomMap.keySet().forEach(session -> {
            try {
                session.sendMessage(new TextMessage(message));
            } catch (IOException e) {
                e.printStackTrace();
            }
        });
    }

    public Optional<Double> calculateAverageVote(Room room) {
        OptionalDouble avg = room.getParticipants().stream()
                .filter(p -> p.getVote() != null)
                .map(Participant::getVote)
                .filter(v -> v.matches("\\d+")) // Nur numerische Karten zählen
                .mapToInt(Integer::parseInt)
                .average();

        if (avg.isPresent()) {
            System.out.println("Berechneter Durchschnitt: " + avg.getAsDouble());
            return Optional.of(avg.getAsDouble());
        } else {
            System.out.println("Kein gültiger Durchschnittswert gefunden.");
            return Optional.empty();
        }
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

    // 🔽 NEU: JSON-Nachricht erzeugen für Broadcast
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
}
