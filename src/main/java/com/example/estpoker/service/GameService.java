package com.example.estpoker.service;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;

@Service
public class GameService {

    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final Map<WebSocketSession, Room> sessionToRoomMap = new ConcurrentHashMap<>();
    private final Map<WebSocketSession, String> sessionToParticipantMap = new ConcurrentHashMap<>();

    // stabile Client-ID -> letzter bekannter Name (pro Room)
    private final Map<String, String> clientToName = new ConcurrentHashMap<>();
    private static String mapKey(String roomCode, String cid) { return roomCode + "|" + cid; }
    public String getClientName(String roomCode, String cid) {
        if (cid == null) return null;
        return clientToName.get(mapKey(roomCode, cid));
    }
    public void rememberClientName(String roomCode, String cid, String name) {
        if (cid != null) clientToName.put(mapKey(roomCode, cid), name);
    }

    private final ObjectMapper objectMapper = new ObjectMapper();

    // Disconnect-Grace (~2s)
    private static final long DISCONNECT_GRACE_MS = 2000L;
    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "disconnect-grace");
                t.setDaemon(true);
                return t;
            });
    private final Map<String, ScheduledFuture<?>> pendingDisconnects = new ConcurrentHashMap<>();
    private static String key(Room room, String name) { return room.getCode() + "|" + name; }

    public Room getOrCreateRoom(String roomCode) { return rooms.computeIfAbsent(roomCode, Room::new); }
    public Room getRoom(String roomCode) { return rooms.get(roomCode); }

    public void addSession(WebSocketSession session, Room room) { sessionToRoomMap.put(session, room); }
    public void trackParticipant(WebSocketSession session, String participantName) { sessionToParticipantMap.put(session, participantName); }
    public Room getRoomForSession(WebSocketSession session) { return sessionToRoomMap.get(session); }
    public String getParticipantName(WebSocketSession session) { return sessionToParticipantMap.get(session); }
    public void removeSession(WebSocketSession session) { sessionToRoomMap.remove(session); sessionToParticipantMap.remove(session); }

    public void revealCards(String roomCode) { Room room = rooms.get(roomCode); if (room != null) room.setCardsRevealed(true); }
    public void resetVotes(String roomCode)   { Room room = rooms.get(roomCode); if (room != null) room.reset(); }

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
                if (session.isOpen()) { session.sendMessage(new TextMessage(message)); return false; }
                else { return true; }
            } catch (IOException e) { e.printStackTrace(); return true; }
        });
    }

    public void broadcastRoomState(Room room) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "voteUpdate");

            List<Participant> ordered = getOrderedParticipants(room);
            List<Map<String, Object>> participants = new ArrayList<>();
            for (Participant p : ordered) {
                Map<String, Object> pData = new HashMap<>();
                pData.put("name", p.getName());
                pData.put("vote", p.getVote());
                pData.put("disconnected", !p.isActive());
                pData.put("isHost", p.isHost());
                participants.add(pData);
            }

            payload.put("participants", participants);
            payload.put("votesRevealed", room.areVotesRevealed());
            payload.put("sequenceId", room.getSequenceId());
            payload.put("cards", room.getCurrentCards());

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

    public void sendRoomStateToSingleSession(Room room, WebSocketSession targetSession) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "voteUpdate");

            List<Participant> ordered = getOrderedParticipants(room);
            List<Map<String, Object>> participants = new ArrayList<>();
            for (Participant p : ordered) {
                Map<String, Object> pData = new HashMap<>();
                pData.put("name", p.getName());
                pData.put("vote", p.getVote());
                pData.put("disconnected", !p.isActive());
                pData.put("isHost", p.isHost());
                participants.add(pData);
            }

            payload.put("participants", participants);
            payload.put("votesRevealed", room.areVotesRevealed());
            payload.put("sequenceId", room.getSequenceId());
            payload.put("cards", room.getCurrentCards());

            Optional<Double> avg = calculateAverageVote(room);
            payload.put("averageVote", room.areVotesRevealed()
                    ? avg.map(a -> String.format("%.1f", a)).orElse("N/A")
                    : null);

            String json = objectMapper.writeValueAsString(payload);
            if (targetSession.isOpen()) targetSession.sendMessage(new TextMessage(json));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public void broadcastHostChange(Room room, String oldHostName, String newHostName) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "hostChanged");
            payload.put("oldHost", oldHostName);
            payload.put("newHost", newHostName);
            String json = objectMapper.writeValueAsString(payload);
            broadcastToRoom(room, json);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private List<Participant> getOrderedParticipants(Room room) {
        List<Participant> all = new ArrayList<>(room.getParticipants());
        Participant host = room.getHost();
        if (host != null) {
            all.removeIf(p -> p.getName().equals(host.getName()));
            List<Participant> ordered = new ArrayList<>();
            ordered.add(host);
            ordered.addAll(all);
            return ordered;
        }
        return all;
    }

    // Disconnect-Grace Window
    public void cancelPendingDisconnect(Room room, String participantName) {
        String k = key(room, participantName);
        ScheduledFuture<?> f = pendingDisconnects.remove(k);
        if (f != null) f.cancel(false);
    }

    public void scheduleDisconnect(Room room, String participantName) {
        if (room == null || participantName == null) return;
        String k = key(room, participantName);

        cancelPendingDisconnect(room, participantName);

        ScheduledFuture<?> f = scheduler.schedule(() -> {
            try {
                Participant participant = room.getParticipant(participantName);
                if (participant != null) participant.setActive(false);

                String newHostName = room.assignNewHostIfNecessary(participantName);
                if (newHostName != null) {
                    broadcastHostChange(room, participantName, newHostName);
                }
                broadcastRoomState(room);
            } finally {
                pendingDisconnects.remove(k);
            }
        }, DISCONNECT_GRACE_MS, TimeUnit.MILLISECONDS);

        pendingDisconnects.put(k, f);
    }
}
