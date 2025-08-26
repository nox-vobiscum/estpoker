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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Game service: room state, participants, voting, topic, auto-reveal, host rotation. */
@Service
public class GameService {

    // --- in-memory state ---
    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final Map<WebSocketSession, Room> sessionToRoomMap = new ConcurrentHashMap<>();
    private final Map<WebSocketSession, String> sessionToParticipantMap = new ConcurrentHashMap<>();

    // Stable client-id per tab -> last known name in that room
    private final Map<String, String> clientToName = new ConcurrentHashMap<>();
    private static String mapKey(String roomCode, String cid) { return roomCode + "|" + cid; }
    public String getClientName(String roomCode, String cid) {
        if (cid == null) return null;
        return clientToName.get(mapKey(roomCode, cid));
    }
    public void rememberClientName(String roomCode, String cid, String name) {
        if (cid != null && name != null && !name.isBlank()) {
            clientToName.put(mapKey(roomCode, cid), name);
        }
        // else ignore
    }

    private final ObjectMapper objectMapper = new ObjectMapper();

    // --- disconnect grace ---
    private static final long DISCONNECT_GRACE_MS = 120_000L; // generous to avoid flapping

    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "disconnect-grace");
                t.setDaemon(true);
                return t;
            });

    private final Map<String, ScheduledFuture<?>> pendingDisconnects = new ConcurrentHashMap<>();
    private static String key(Room room, String name) { return room.getCode() + "|" + name; }

    // --- rooms ---
    public Room getOrCreateRoom(String roomCode) { return rooms.computeIfAbsent(roomCode, Room::new); }
    public Room getRoom(String roomCode) { return rooms.get(roomCode); }
    public Room room(String roomCode) { return getRoom(roomCode); } // alias for handler

    // --- ws session tracking (kept as-is for handler integration) ---
    public void addSession(WebSocketSession session, Room room) { sessionToRoomMap.put(session, room); }
    public void trackParticipant(WebSocketSession session, String participantName) { sessionToParticipantMap.put(session, participantName); }
    public Room getRoomForSession(WebSocketSession session) { return sessionToRoomMap.get(session); }
    public String getParticipantName(WebSocketSession session) { return sessionToParticipantMap.get(session); }
    public void removeSession(WebSocketSession session) {
        sessionToRoomMap.remove(session);
        sessionToParticipantMap.remove(session);
    }

    // --- public api used by handler -------------------------------------------------------------

    /**
     * Join or rejoin by stable CID (prevents duplicate rows on refresh).
     * Signature matches the handler: (roomCode, cid, participantName).
     */
    public Room join(String roomCode, String cid, String participantName) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) {
            // If CID already known, reuse that participant (no duplicate on refresh)
            Participant p = room.getParticipantByCid(cid).orElse(null);

            if (p == null) {
                // No cid mapping yet → try by provided name
                p = room.getParticipant(participantName);
                if (p == null) {
                    p = new Participant(participantName);
                    room.addParticipant(p);
                }
                // Link cid -> canonical name for future reconnects
                room.linkCid(cid, p.getName());
            }

            // Mark presence
            p.setActive(true);
            p.setParticipating(true); // default when joining
            p.bumpLastSeen();
            rememberClientName(roomCode, cid, p.getName());

            // Ensure a host exists
            if (room.getHost() == null) {
                p.setHost(true);
            }
        }
        broadcastRoomState(room);
        return room;
    }

    /**
     * Mark connected/disconnected by CID (2nd parameter is CID, per handler usage).
     * If announce==true, broadcast state.
     */
    public void markConnected(String roomCode, String cid, boolean announce) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) {
            Participant p = room.getParticipantByCid(cid).orElse(null);
            if (p == null) {
                // Fallback: try last known name for this cid
                String last = getClientName(roomCode, cid);
                if (last != null) p = room.getParticipant(last);
            }
            if (p != null) {
                p.setActive(true);
                p.bumpLastSeen();
                if (room.getHost() == null) p.setHost(true);
            }
        }
        if (announce) broadcastRoomState(room);
    }

    /**
     * Update a vote. Accepts either a name or a CID as second argument (handler sends CID).
     * Triggers auto-reveal if enabled and all active participants have valid votes.
     */
    public void setVote(String roomCode, String nameOrCid, String value) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) {
            Participant p = room.getParticipantByCid(nameOrCid).orElse(null);
            if (p == null) p = room.getParticipant(nameOrCid); // fallback: treat as name
            if (p == null) {
                // If totally unknown, create by name as last resort (rare)
                p = new Participant(nameOrCid);
                room.addParticipant(p);
            }
            p.setVote(value);
            p.bumpLastSeen();

            if (room.isAutoRevealEnabled() && !room.areVotesRevealed() && allActiveParticipantsHaveValidVotes(room)) {
                room.setCardsRevealed(true);
            }
        }
        broadcastRoomState(room);
    }

    /** Reveal result explicitly. */
    public void reveal(String roomCode) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) { room.setCardsRevealed(true); }
        broadcastRoomState(room);
    }

    /** Reset for a new round. */
    public void reset(String roomCode) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) { room.reset(); }
        broadcastRoomState(room);
    }

    /** Save topic (label+optional url), make it visible. */
    public void saveTopic(String roomCode, String input) {
        Room room = getOrCreateRoom(roomCode);
        String[] parsed = parseTopic(input);
        synchronized (room) {
            room.setTopicLabel(parsed[0]);
            room.setTopicUrl(parsed[1]);
            room.setTopicVisible(true);
        }
        broadcastRoomState(room);
    }

    /** Clear topic and hide it. */
    public void clearTopic(String roomCode) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) {
            room.setTopicLabel(null);
            room.setTopicUrl(null);
            room.setTopicVisible(false);
        }
        broadcastRoomState(room);
    }

    /** Toggle topic visibility without changing content. */
    public void setTopicEnabled(String roomCode, boolean enabled) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) { room.setTopicVisible(enabled); }
        broadcastRoomState(room);
    }

    /** NEW: Toggle auto-reveal flag and broadcast. */
    public void setAutoRevealEnabled(String roomCode, boolean enabled) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) { room.setAutoRevealEnabled(enabled); }
        broadcastRoomState(room);
    }

    /**
     * Observer toggle (handler passes CID as 2nd argument; this also supports name).
     * observer=false => participating=true. Clears vote when becoming observer.
     */
    public void setObserver(String roomCode, String nameOrCid, boolean observer) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) {
            Participant p = room.getParticipantByCid(nameOrCid).orElse(null);
            if (p == null) p = room.getParticipant(nameOrCid);

            if (p == null) {
                p = new Participant(nameOrCid);
                room.addParticipant(p);
            }
            boolean participating = !observer;
            p.setParticipating(participating);
            if (!participating) p.setVote(null); // observers cannot hold a vote
            p.bumpLastSeen();
        }
        broadcastRoomState(room);
    }

    /** Keep-alive ping from client (supports cid or name); prevents false host demotion. */
    public void touch(String roomCode, String nameOrCid) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) {
            Participant p = room.getParticipantByCid(nameOrCid).orElse(null);
            if (p == null) p = room.getParticipant(nameOrCid);
            if (p != null) {
                p.setActive(true);
                p.bumpLastSeen();
            }
        }
    }

    /** Return true if auto-reveal conditions are met (check only, do not flip state). */
    public boolean shouldAutoReveal(String roomCode) {
        Room room = getRoom(roomCode);
        if (room == null) return false;
        synchronized (room) {
            return room.isAutoRevealEnabled()
                    && !room.areVotesRevealed()
                    && allActiveParticipantsHaveValidVotes(room);
        }
    }

    /**
     * Ensure a host exists; if current host is inactive for longer than limits, promote someone else.
     * softMs: advisory (no action), hardMs: demote & reassign.
     */
    public void ensureHost(String roomCode, long softMs, long hardMs) {
        Room room = getRoom(roomCode);
        if (room == null) return;

        String oldHost = null;
        String newHost = null;

        synchronized (room) {
            Participant host = room.getHost();
            long now = System.currentTimeMillis();

            if (host == null) {
                newHost = room.assignNewHostIfNecessary(null);
            } else {
                long idle = now - host.getLastSeenAt();
                if (!host.isActive() || idle >= hardMs) {
                    oldHost = host.getName();
                    host.setHost(false);
                    newHost = room.assignNewHostIfNecessary(oldHost);
                }
            }
        }

        if (newHost != null) {
            broadcastHostChange(room, oldHost, newHost);
            broadcastRoomState(room);
        }
    }

    // --- calculations / helpers ---------------------------------------------------------------

    public void revealCards(String roomCode) {
        Room room = rooms.get(roomCode);
        if (room != null) room.setCardsRevealed(true);
    }

    public void resetVotes(String roomCode) {
        Room room = rooms.get(roomCode);
        if (room != null) room.reset();
    }

    /** Average over active+participating, deduped by name, ignoring specials. */
    public OptionalDouble calculateAverageVote(Room room) {
        Map<String, Double> nv = collectNumericVotes(room);
        return nv.values().stream().mapToDouble(Double::doubleValue).average();
    }

    /** Median over the same filtered set as average. */
    public OptionalDouble calculateMedian(Room room) {
        Map<String, Double> nv = collectNumericVotes(room);
        if (nv.isEmpty()) return OptionalDouble.empty();
        List<Double> sorted = new ArrayList<>(nv.values());
        sorted.sort(Comparator.naturalOrder());
        int n = sorted.size();
        if (n % 2 == 1) return OptionalDouble.of(sorted.get(n / 2));
        double m = (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;
        return OptionalDouble.of(m);
    }

    /** Range string "min–max" (localized formatting) for same filtered set as average. */
    public String calculateRange(Room room, Locale locale) {
        Map<String, Double> nv = collectNumericVotes(room);
        if (nv.size() < 1) return null;
        double min = nv.values().stream().mapToDouble(Double::doubleValue).min().orElse(Double.NaN);
        double max = nv.values().stream().mapToDouble(Double::doubleValue).max().orElse(Double.NaN);
        if (Double.isNaN(min) || Double.isNaN(max)) return null;

        String minS = CardSequences.formatAverage(OptionalDouble.of(min), locale);
        String maxS = CardSequences.formatAverage(OptionalDouble.of(max), locale);

        // use a real en-dash; keep it simple
        return minS + "–" + maxS;
    }

    /** True if all numeric votes (after filtering) are identical AND >= 1 present. */
    public boolean isConsensus(Room room) {
        Map<String, Double> nv = collectNumericVotes(room);
        if (nv.isEmpty()) return false;
        double first = nv.values().iterator().next();
        for (double v : nv.values()) {
            if (Double.compare(v, first) != 0) return false;
        }
        return true;
    }

    /** Names furthest from the average (>=3 numeric votes). */
    public List<String> farthestFromAverageNames(Room room) {
        Map<String, Double> nv = collectNumericVotes(room);
        if (nv.size() < 3) return List.of();
        OptionalDouble avgOpt = nv.values().stream().mapToDouble(Double::doubleValue).average();
        if (avgOpt.isEmpty()) return List.of();
        double avg = avgOpt.getAsDouble();

        double maxDist = -1d;
        Map<String, Double> dist = new LinkedHashMap<>();
        for (Map.Entry<String, Double> e : nv.entrySet()) {
            double d = Math.abs(e.getValue() - avg);
            dist.put(e.getKey(), d);
            if (d > maxDist) maxDist = d;
        }
        if (maxDist <= 0) return List.of();

        final double eps = 1e-9;
        List<String> out = new ArrayList<>();
        for (Map.Entry<String, Double> e : dist.entrySet()) {
            if (Math.abs(e.getValue() - maxDist) <= eps) out.add(e.getKey());
        }
        return out;
    }

    /** Collect numeric votes: active + participating, dedupe by name, ignore specials/null. */
    private Map<String, Double> collectNumericVotes(Room room) {
        Map<String, Double> out = new LinkedHashMap<>();
        if (room == null) return out;
        Set<String> seen = new HashSet<>();
        for (Participant p : room.getParticipants()) {
            if (!p.isActive() || !p.isParticipating()) continue;
            if (!seen.add(p.getName())) continue;
            String v = p.getVote();
            OptionalDouble num = CardSequences.parseNumeric(v);
            if (num.isPresent()) out.put(p.getName(), num.getAsDouble());
        }
        return out;
    }

    public boolean isValidVote(String v) {
        return v != null && !CardSequences.SPECIALS.contains(v);
    }

    public boolean allActiveParticipantsHaveValidVotes(Room room) {
        if (room == null) return false;
        for (Participant p : room.getParticipants()) {
            if (p.isActive() && p.isParticipating()) {
                String v = p.getVote();
                if (v == null || !isValidVote(v)) return false;
            }
        }
        return true;
    }

    // --- broadcast / snapshots ----------------------------------------------------------------

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

            // Order with host first; dedupe by name into a single row per logical participant.
            List<Participant> ordered = getOrderedParticipants(room);
            Map<String, Map<String, Object>> byName = new LinkedHashMap<>();

            for (Participant p : ordered) {
                Map<String, Object> cur = byName.get(p.getName());
                if (cur == null) {
                    cur = new HashMap<>();
                    cur.put("name", p.getName());
                    cur.put("vote", p.getVote());
                    cur.put("disconnected", !p.isActive());
                    cur.put("isHost", p.isHost());
                    cur.put("participating", p.isParticipating());
                    byName.put(p.getName(), cur);
                } else {
                    if (p.getVote() != null) cur.put("vote", p.getVote());
                    if (p.isHost()) cur.put("isHost", true);
                    if (p.isParticipating()) cur.put("participating", true);
                    if (p.isActive()) cur.put("disconnected", false);
                }
            }
            payload.put("participants", new ArrayList<>(byName.values()));

            boolean revealed = room.areVotesRevealed();
            payload.put("votesRevealed", revealed);

            Locale loc = Locale.getDefault();

            // Average (existing)
            OptionalDouble avg = calculateAverageVote(room);
            String avgDisplay = avg.isPresent()
                    ? CardSequences.formatAverage(avg, loc)
                    : "-";
            payload.put("averageVote", revealed ? avgDisplay : null);

            // NEW: median / range / consensus / outliers (only when revealed)
            if (revealed) {
                OptionalDouble med = calculateMedian(room);
                payload.put("medianVote", med.isPresent() ? CardSequences.formatAverage(med, loc) : null);

                String range = calculateRange(room, loc);
                payload.put("range", range);

                boolean consensus = isConsensus(room);
                payload.put("consensus", consensus);

                List<String> outliers = farthestFromAverageNames(room);
                payload.put("outliers", outliers);
            } else {
                payload.put("medianVote", null);
                payload.put("range", null);
                payload.put("consensus", false);
                payload.put("outliers", List.of());
            }

            payload.put("sequenceId", room.getSequenceId());
            payload.put("cards", room.getCurrentCards());
            payload.put("autoRevealEnabled", room.isAutoRevealEnabled());

            // topic
            payload.put("topicLabel", room.getTopicLabel());
            payload.put("topicUrl", room.getTopicUrl());
            payload.put("topicVisible", room.isTopicVisible());

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
            Map<String, Map<String, Object>> byName = new LinkedHashMap<>();
            for (Participant p : ordered) {
                Map<String, Object> cur = byName.get(p.getName());
                if (cur == null) {
                    cur = new HashMap<>();
                    cur.put("name", p.getName());
                    cur.put("vote", p.getVote());
                    cur.put("disconnected", !p.isActive());
                    cur.put("isHost", p.isHost());
                    cur.put("participating", p.isParticipating());
                    byName.put(p.getName(), cur);
                } else {
                    if (p.getVote() != null) cur.put("vote", p.getVote());
                    if (p.isHost()) cur.put("isHost", true);
                    if (p.isParticipating()) cur.put("participating", true);
                    if (p.isActive()) cur.put("disconnected", false);
                }
            }

            payload.put("participants", new ArrayList<>(byName.values()));

            boolean revealed = room.areVotesRevealed();
            payload.put("votesRevealed", revealed);

            Locale loc = Locale.getDefault();

            OptionalDouble avg = calculateAverageVote(room);
            String avgDisplay = avg.isPresent()
                    ? CardSequences.formatAverage(avg, loc)
                    : "-";
            payload.put("averageVote", revealed ? avgDisplay : null);

            if (revealed) {
                OptionalDouble med = calculateMedian(room);
                payload.put("medianVote", med.isPresent() ? CardSequences.formatAverage(med, loc) : null);

                String range = calculateRange(room, loc);
                payload.put("range", range);

                boolean consensus = isConsensus(room);
                payload.put("consensus", consensus);

                List<String> outliers = farthestFromAverageNames(room);
                payload.put("outliers", outliers);
            } else {
                payload.put("medianVote", null);
                payload.put("range", null);
                payload.put("consensus", false);
                payload.put("outliers", List.of());
            }

            payload.put("sequenceId", room.getSequenceId());
            payload.put("cards", room.getCurrentCards());
            payload.put("autoRevealEnabled", room.isAutoRevealEnabled());

            payload.put("topicLabel", room.getTopicLabel());
            payload.put("topicUrl", room.getTopicUrl());
            payload.put("topicVisible", room.isTopicVisible());

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

    // --- disconnect grace window ---------------------------------------------------------------

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

    // --- explicit leave / kick / close ---------------------------------------------------------

    public void markLeftIntentionally(Room room, String participantName) {
        if (room == null || participantName == null) return;

        cancelPendingDisconnect(room, participantName);

        Participant participant = room.getParticipant(participantName);
        if (participant != null) participant.setActive(false);

        String newHost = room.assignNewHostIfNecessary(participantName);
        if (newHost != null) broadcastHostChange(room, participantName, newHost);

        broadcastRoomState(room);
    }

    public void handleIntentionalLeave(String roomCode, String participantName) {
        Room room = getRoom(roomCode);
        if (room != null && participantName != null) {
            markLeftIntentionally(room, participantName);
        }
    }

    public void kickParticipant(Room room, String targetName) {
        if (room == null || targetName == null) return;

        String json;
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "kicked");
            payload.put("redirect", "/");
            json = objectMapper.writeValueAsString(payload);
        } catch (IOException e) {
            json = "{\"type\":\"kicked\",\"redirect\":\"/\"}";
        }

        List<WebSocketSession> targetSessions = new ArrayList<>();
        for (Map.Entry<WebSocketSession, Room> e : sessionToRoomMap.entrySet()) {
            if (room.equals(e.getValue())) {
                WebSocketSession s = e.getKey();
                String name = sessionToParticipantMap.get(s);
                if (targetName.equals(name)) targetSessions.add(s);
            }
        }
        for (WebSocketSession s : targetSessions) {
            try { if (s.isOpen()) s.sendMessage(new TextMessage(json)); } catch (IOException ignored) {}
            sessionToRoomMap.remove(s);
            sessionToParticipantMap.remove(s);
            try { s.close(new CloseStatus(4001, "Kicked")); } catch (IOException ignored) {}
        }

        cancelPendingDisconnect(room, targetName);
        room.removeParticipant(targetName);

        String newHost = room.assignNewHostIfNecessary(targetName);
        if (newHost != null) broadcastHostChange(room, targetName, newHost);

        broadcastRoomState(room);
    }

    /** Overload: close by room code. */
    public void closeRoom(String roomCode) {
        Room room = getRoom(roomCode);
        closeRoom(room);
    }

    public void closeRoom(Room room) {
        if (room == null) return;

        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "roomClosed");
            payload.put("redirect", "/");
            String json = objectMapper.writeValueAsString(payload);
            broadcastToRoom(room, json);
        } catch (IOException e) {
            e.printStackTrace();
        }

        List<WebSocketSession> toClose = new ArrayList<>();
        for (Map.Entry<WebSocketSession, Room> e : sessionToRoomMap.entrySet()) {
            if (room.equals(e.getValue())) toClose.add(e.getKey());
        }
        for (WebSocketSession s : toClose) {
            try { s.close(new CloseStatus(4000, "Room closed")); } catch (IOException ignored) {}
            sessionToRoomMap.remove(s);
            sessionToParticipantMap.remove(s);
        }

        for (Participant p : new ArrayList<>(room.getParticipants())) cancelPendingDisconnect(room, p.getName());

        rooms.remove(room.getCode());
    }

    // --- identity ping to one session ----------------------------------------------------------

    public void sendIdentity(WebSocketSession session, String yourName, String cid) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "you");
            payload.put("yourName", yourName);
            if (cid != null) payload.put("cid", cid);
            String json = objectMapper.writeValueAsString(payload);
            if (session.isOpen()) session.sendMessage(new TextMessage(json));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    // --- topic parsing -------------------------------------------------------------------------

    private static final Pattern JIRA_KEY = Pattern.compile("\\b([A-Z][A-Z0-9]+-\\d+)\\b");

    /** Returns [label, urlOrNull]. If input is a URL, use it; label is either key or trimmed text. */
    private static String[] parseTopic(String input) {
        if (input == null) return new String[]{null, null};
        String s = input.trim();
        if (s.isEmpty()) return new String[]{null, null};

        boolean isUrl = s.startsWith("http://") || s.startsWith("https://");
        String url = isUrl ? s : null;

        String label;
        Matcher m = JIRA_KEY.matcher(s);
        if (m.find()) {
            label = m.group(1);
        } else {
            label = s.length() > 140 ? s.substring(0, 140) + "…" : s;
        }
        return new String[]{label, url};
    }
}
