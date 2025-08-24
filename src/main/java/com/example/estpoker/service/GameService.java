package com.example.estpoker.service;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.model.CardSequences;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

@Service
public class GameService {

    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final Map<WebSocketSession, Room> sessionToRoomMap = new ConcurrentHashMap<>();
    private final Map<WebSocketSession, String> sessionToParticipantMap = new ConcurrentHashMap<>();

    // Stable Client-ID -> last known name (per room)
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

    // --- Disconnect-Grace (~2s) ---
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
        if (room != null) room.setCardsRevealed(true);
    }

    public void resetVotes(String roomCode) {
        Room room = rooms.get(roomCode);
        if (room != null) room.reset();
    }

    /**
     * Average over all valid votes of participating users.
     * Uses CardSequences.averageOfStrings -> "½" treated as 0.5,
     * specials (❓💬☕) ignored.
     */
    public OptionalDouble calculateAverageVote(Room room) {
        List<String> votes = room.getParticipants().stream()
                .filter(Participant::isParticipating)
                .map(Participant::getVote)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        return CardSequences.averageOfStrings(votes);
    }

    /** === Auto-Reveal helpers === */

    /** Valid = set and not a special (❓💬☕). */
    public boolean isValidVote(String v) {
        return v != null && !CardSequences.SPECIALS.contains(v);
    }

    /** Have all ACTIVE & PARTICIPATING users cast a valid vote? */
    public boolean allActiveParticipantsHaveValidVotes(Room room) {
        if (room == null) return false;
        synchronized (room) {
            for (Participant p : room.getParticipants()) {
                if (p.isActive() && p.isParticipating()) {
                    String v = p.getVote();
                    if (v == null || !isValidVote(v)) {
                        return false;
                    }
                }
            }
            return true;
        }
    }

    /**
     * Sets votesRevealed=true if not revealed and all participating actives have valid votes.
     * Respects room.isAutoRevealEnabled().
     */
    public boolean maybeAutoReveal(Room room) {
        if (room == null) return false;
        synchronized (room) {
            if (room.isAutoRevealEnabled()
                    && !room.areVotesRevealed()
                    && allActiveParticipantsHaveValidVotes(room)) {
                room.setCardsRevealed(true);
                return true;
            }
            return false;
        }
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

    /** Broadcast the full current room state to all sessions in the room. */
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
                pData.put("participating", p.isParticipating());
                participants.add(pData);
            }

            payload.put("participants", participants);
            payload.put("votesRevealed", room.areVotesRevealed());

            OptionalDouble avg = calculateAverageVote(room);
            String avgDisplay = avg.isPresent()
                    ? CardSequences.formatAverage(avg, Locale.getDefault())
                    : "-";
            payload.put("averageVote", room.areVotesRevealed() ? avgDisplay : null);

            payload.put("sequenceId", room.getSequenceId());
            payload.put("cards", room.getCurrentCards());

            // Auto-Reveal flag
            payload.put("autoRevealEnabled", room.isAutoRevealEnabled());

            // Topic (Ticket/Story) + visibility (NEW)
            payload.put("topicLabel", room.getTopicLabel());
            payload.put("topicUrl", room.getTopicUrl());
            payload.put("topicVisible", room.isTopicVisible()); // <— NEW

            String json = objectMapper.writeValueAsString(payload);
            broadcastToRoom(room, json);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    /** Send the current room state only to the given session (e.g., just connected). */
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
                pData.put("participating", p.isParticipating());
                participants.add(pData);
            }

            payload.put("participants", participants);
            payload.put("votesRevealed", room.areVotesRevealed());

            OptionalDouble avg = calculateAverageVote(room);
            String avgDisplay = avg.isPresent()
                    ? CardSequences.formatAverage(avg, Locale.getDefault())
                    : "-";
            payload.put("averageVote", room.areVotesRevealed() ? avgDisplay : null);

            payload.put("sequenceId", room.getSequenceId());
            payload.put("cards", room.getCurrentCards());

            payload.put("autoRevealEnabled", room.isAutoRevealEnabled());

            // Topic (Ticket/Story) + visibility (NEW)
            payload.put("topicLabel", room.getTopicLabel());
            payload.put("topicUrl", room.getTopicUrl());
            payload.put("topicVisible", room.isTopicVisible()); // <— NEW

            String json = objectMapper.writeValueAsString(payload);

            if (targetSession.isOpen()) {
                targetSession.sendMessage(new TextMessage(json));
            }

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

    // --- Disconnect-Grace Window ---
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

    // ===== kick participant (host only triggers via handler) =====
    public void kickParticipant(Room room, String targetName) {
        if (room == null || targetName == null) return;

        // 1) tell target sessions "kicked" + close, remove mappings first
        String json;
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "kicked");
            payload.put("redirect", "/"); // index/start
            json = objectMapper.writeValueAsString(payload);
        } catch (IOException e) {
            json = "{\"type\":\"kicked\",\"redirect\":\"/\"}";
        }

        List<WebSocketSession> targetSessions = new ArrayList<>();
        for (Map.Entry<WebSocketSession, Room> e : sessionToRoomMap.entrySet()) {
            if (room.equals(e.getValue())) {
                WebSocketSession s = e.getKey();
                String name = sessionToParticipantMap.get(s);
                if (targetName.equals(name)) {
                    targetSessions.add(s);
                }
            }
        }
        for (WebSocketSession s : targetSessions) {
            try {
                if (s.isOpen()) s.sendMessage(new TextMessage(json));
            } catch (IOException ignored) {}
            sessionToRoomMap.remove(s);
            sessionToParticipantMap.remove(s);
            try { s.close(new CloseStatus(4001, "Kicked")); } catch (IOException ignored) {}
        }

        // 2) cancel pending disconnects and remove from room
        cancelPendingDisconnect(room, targetName);
        room.removeParticipant(targetName);

        // 3) if (unexpectedly) host -> find new host & notify
        String newHost = room.assignNewHostIfNecessary(targetName);
        if (newHost != null) {
            broadcastHostChange(room, targetName, newHost);
        }

        // 4) broadcast updated room state
        broadcastRoomState(room);
    }

    // ===== close room (host) =====
    public void closeRoom(Room room) {
        if (room == null) return;

        // 1) notify all clients: room closed -> redirect "/"
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "roomClosed");
            payload.put("redirect", "/");
            String json = objectMapper.writeValueAsString(payload);
            broadcastToRoom(room, json);
        } catch (IOException e) {
            e.printStackTrace();
        }

        // 2) close sessions & clean mappings
        List<WebSocketSession> toClose = new ArrayList<>();
        for (Map.Entry<WebSocketSession, Room> e : sessionToRoomMap.entrySet()) {
            if (room.equals(e.getValue())) {
                toClose.add(e.getKey());
            }
        }
        for (WebSocketSession s : toClose) {
            try { s.close(new CloseStatus(4000, "Room closed")); } catch (IOException ignored) {}
            sessionToRoomMap.remove(s);
            sessionToParticipantMap.remove(s);
        }

        // 3) cancel pending disconnects
        for (Participant p : new ArrayList<>(room.getParticipants())) {
            cancelPendingDisconnect(room, p.getName());
        }

        // 4) remove room from registry
        rooms.remove(room.getCode());
    }

    /* ===== Identity message only to the connecting session ===== */
    public void sendIdentity(WebSocketSession session, String yourName, String cid) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "you");
            payload.put("yourName", yourName);
            if (cid != null) payload.put("cid", cid);
            String json = objectMapper.writeValueAsString(payload);
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(json));
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
