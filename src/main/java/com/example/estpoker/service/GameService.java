package com.example.estpoker.service;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.model.CardSequences;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.estpoker.rooms.service.RoomSnapshotter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Game service: room state, participants, voting, topic, auto-reveal, host rotation & presence toasts. */
@Service
public class GameService {

    private static final Logger log = LoggerFactory.getLogger(GameService.class);

    // --- optional snapshot hook (non-fatal, may be null) ---
    private final RoomSnapshotter snapshotter;

    /** Default ctor for tests (no Spring context): snapshotter stays null. */
    public GameService() {
        this.snapshotter = null;
    }

    /** Spring-injected provider (preferred at runtime). */
    @Autowired
    public GameService(ObjectProvider<RoomSnapshotter> snapshotterProvider) {
        this.snapshotter = (snapshotterProvider != null ? snapshotterProvider.getIfAvailable() : null);
    }

    private void snapshot(Room room, String actor) {
        if (snapshotter != null && room != null) {
            snapshotter.onChange(room, (actor != null && !actor.isBlank()) ? actor : "system");
        }
    }

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
    }

    private final ObjectMapper objectMapper = new ObjectMapper();

    // --- disconnect & host grace ---
    private static final long LEAVE_GRACE_MS = 2_000L;
    private static final long HOST_GRACE_UNEXPECTED_MS = 5_000L;
    private static final long HOST_GRACE_INTENTIONAL_MS = 2_000L;

    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "presence-grace");
                t.setDaemon(true);
                return t;
            });

    private final Map<String, ScheduledFuture<?>> pendingDisconnects = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> pendingHostTransfers = new ConcurrentHashMap<>();

    private static String key(Room room, String name) { return room.getCode() + "|" + name; }

    // --- rooms ---
    public Room getOrCreateRoom(String roomCode) { return rooms.computeIfAbsent(roomCode, Room::new); }
    public Room getRoom(String roomCode) { return rooms.get(roomCode); }
    public Room room(String roomCode) { return getRoom(roomCode); }

    // --- ws session tracking ---
    public void addSession(WebSocketSession session, Room room) { sessionToRoomMap.put(session, room); }
    public void trackParticipant(WebSocketSession session, String participantName) { sessionToParticipantMap.put(session, participantName); }
    public Room getRoomForSession(WebSocketSession session) { return sessionToRoomMap.get(session); }
    public String getParticipantName(WebSocketSession session) { return sessionToParticipantMap.get(session); }
    public void removeSession(WebSocketSession session) {
        sessionToRoomMap.remove(session);
        sessionToParticipantMap.remove(session);
    }

    // ========================================================================
    //  JOIN / RENAME
    // ========================================================================

    public Room join(String roomCode, String cid, String requestedName) {
        Room room = getOrCreateRoom(roomCode);
        String desired = normalizeName(requestedName);
        String actor = null;

        synchronized (room) {
            Participant byCid = room.getParticipantByCid(cid).orElse(null);
            if (byCid != null) {
                byCid.setActive(true);
                byCid.setParticipating(true);
                byCid.bumpLastSeen();
                if (room.getHost() == null) byCid.setHost(true);
                rememberClientName(roomCode, cid, byCid.getName());
                cancelPresenceTimers(room, byCid.getName());
                actor = byCid.getName();
            } else {
                String unique = uniqueNameFor(room, desired, null);
                Participant p = new Participant(unique);
                p.setActive(true);
                p.setParticipating(true);
                p.bumpLastSeen();
                if (room.getHost() == null) p.setHost(true);

                room.addParticipant(p);
                room.linkCid(cid, unique);
                rememberClientName(roomCode, cid, unique);
                cancelPresenceTimers(room, unique);
                actor = unique;
            }
        }

        broadcastRoomState(room);
        snapshot(room, actor);
        return room;
    }

    public String renameParticipant(String roomCode, String cid, String requestedName) {
        Room room = getRoom(roomCode);
        if (room == null || cid == null) return null;

        String oldName = null;
        String finalName;

        synchronized (room) {
            Participant cur = room.getParticipantByCid(cid).orElse(null);
            String desired = (requestedName == null ? "" : requestedName.trim());
            if (desired.isEmpty()) desired = "Guest";

            if (cur == null) {
                String unique = uniqueNameFor(room, desired, null);
                Participant p = room.getParticipant(unique);
                if (p == null) {
                    p = new Participant(unique);
                    p.setActive(true);
                    p.setParticipating(true);
                    p.bumpLastSeen();
                    if (room.getHost() == null) p.setHost(true);
                    room.addParticipant(p);
                }
                room.linkCid(cid, p.getName());
                finalName = p.getName();
            } else {
                oldName = cur.getName();
                String unique = uniqueNameFor(room, desired, oldName);
                if (unique.equals(oldName)) {
                    finalName = oldName;
                } else {
                    Participant repl = new Participant(unique);
                    repl.setActive(cur.isActive());
                    repl.setParticipating(cur.isParticipating());
                    repl.setHost(cur.isHost());
                    repl.setVote(cur.getVote());

                    room.addParticipant(repl);
                    room.linkCid(cid, unique);
                    room.removeParticipant(oldName);

                    finalName = unique;
                }
            }

            rememberClientName(roomCode, cid, finalName);
        }

        if (oldName != null && !Objects.equals(oldName, finalName)) {
            broadcastParticipantRenamed(room, oldName, finalName);
        }
        broadcastRoomState(room);
        snapshot(room, finalName);
        return finalName;
    }

    private static String uniqueNameFor(Room room, String desired, String selfName) {
        String base = (desired == null || desired.isBlank()) ? "Guest" : desired.trim();
        String candidate = base;
        int suffix = 2;

        while (true) {
            Participant clash = room.getParticipant(candidate);
            if (clash == null || (selfName != null && selfName.equals(candidate))) {
                return candidate;
            }
            candidate = base + " (" + suffix + ")";
            suffix++;
        }
    }

    private static String normalizeName(String s) {
        String t = (s == null) ? "" : s.trim();
        if (t.isEmpty()) t = "Guest";
        if (t.length() > 80) t = t.substring(0, 80);
        return t;
    }

    // ========================================================================
    //  PRESENCE / VOTE / TOPIC / SEQUENCE / HOSTING
    // ========================================================================

    public void setVote(String roomCode, String nameOrCid, String value) {
        Room room = getOrCreateRoom(roomCode);
        String actor;
        synchronized (room) {
            Participant p = room.getParticipantByCid(nameOrCid).orElse(null);
            if (p == null) p = room.getParticipant(nameOrCid);
            if (p == null) {
                p = new Participant(nameOrCid);
                room.addParticipant(p);
            }
            p.setVote(value);
            p.bumpLastSeen();
            actor = p.getName();

            if (room.isAutoRevealEnabled() && !room.areVotesRevealed() && allActiveParticipantsHaveValidVotes(room)) {
                room.setCardsRevealed(true);
            }
        }
        broadcastRoomState(room);
        snapshot(room, actor);
    }

    public void reveal(String roomCode) {
        Room room = getOrCreateRoom(roomCode);
        String actor = null;
        synchronized (room) {
            room.setCardsRevealed(true);
            Participant host = room.getHost();
            actor = (host != null ? host.getName() : null);
        }
        broadcastRoomState(room);
        snapshot(room, actor);
    }

    public void reset(String roomCode) {
        Room room = getOrCreateRoom(roomCode);
        String actor = null;
        synchronized (room) {
            room.reset();
            Participant host = room.getHost();
            actor = (host != null ? host.getName() : null);
        }
        broadcastRoomState(room);
        snapshot(room, actor);
    }

    public void saveTopic(String roomCode, String input) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) {
            String[] parsed = parseTopic(input);
            room.setTopicLabel(parsed[0]);
            room.setTopicUrl(parsed[1]);
            room.setTopicVisible(true);
        }
        broadcastRoomState(room);
        snapshot(room, "ws");
    }

    public void clearTopic(String roomCode) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) {
            room.setTopicLabel(null);
            room.setTopicUrl(null);
            room.setTopicVisible(false);
        }
        broadcastRoomState(room);
        snapshot(room, "ws");
    }

    public void setTopicEnabled(String roomCode, boolean enabled) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) { room.setTopicVisible(enabled); }
        broadcastRoomState(room);
        snapshot(room, "ws");
    }

    public void setAutoRevealEnabled(String roomCode, boolean enabled) {
        Room room = getOrCreateRoom(roomCode);
        boolean flippedToRevealed = false;
        synchronized (room) {
            room.setAutoRevealEnabled(enabled);
            if (enabled && !room.areVotesRevealed() && allActiveParticipantsHaveValidVotes(room)) {
                room.setCardsRevealed(true);
                flippedToRevealed = true;
            }
        }
        if (flippedToRevealed && log.isDebugEnabled()) {
            log.debug("Auto-reveal: immediately revealing room={} (all votes present)", roomCode);
        }
        broadcastRoomState(room);
        snapshot(room, "ws");
    }

    public void setAllowSpecials(String roomCode, boolean allow) {
        Room room = getOrCreateRoom(roomCode);
        boolean changed = false;

        synchronized (room) {
            if (room.isAllowSpecials() != allow) {
                room.setAllowSpecials(allow);
                changed = true;

                if (!allow) {
                    for (Participant p : room.getParticipants()) {
                        String v = p.getVote();
                        if (CardSequences.isSpecial(v)) {
                            p.setVote(null);
                        }
                    }
                }
            }
        }

        if (changed) {
            broadcastRoomState(room);
            snapshot(room, "ws");
        }
    }

    public void setSpectator(String roomCode, String nameOrCid, boolean spectator) {
        Room room = getOrCreateRoom(roomCode);
        String actor = null;
        synchronized (room) {
            Participant p = room.getParticipantByCid(nameOrCid).orElse(null);
            if (p == null) p = room.getParticipant(nameOrCid);

            if (p == null) {
                p = new Participant(nameOrCid);
                room.addParticipant(p);
            }
            boolean participating = !spectator;
            p.setParticipating(participating);
            if (!participating) p.setVote(null);
            p.bumpLastSeen();
            actor = p.getName();
        }
        broadcastRoomState(room);
        snapshot(room, actor);
    }

    /** Keep-alive ping to keep presence fresh (no snapshot). */
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

    public void setSequence(String roomCode, String sequenceId) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) {
            String normalized = sanitizeSequenceId(sequenceId);
            room.setSequenceId(normalized);
            room.reset();
        }
        broadcastRoomState(room);
        snapshot(room, "ws");
    }

    public void makeHost(String roomCode, String targetName) {
        Room room = getRoom(roomCode);
        if (room == null || targetName == null) return;

        String oldHost = null;
        synchronized (room) {
            Participant target = room.getParticipant(targetName);
            if (target == null) return;
            Participant cur = room.getHost();
            if (cur != null) {
                oldHost = cur.getName();
                cur.setHost(false);
            }
            target.setHost(true);
            target.bumpLastSeen();
        }
        broadcastHostChange(room, oldHost, targetName);
        broadcastRoomState(room);
        snapshot(room, targetName);
    }

    public boolean shouldAutoReveal(String roomCode) {
        Room room = getRoom(roomCode);
        if (room == null) return false;
        synchronized (room) {
            return room.isAutoRevealEnabled()
                    && !room.areVotesRevealed()
                    && allActiveParticipantsHaveValidVotes(room);
        }
    }

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
            snapshot(room, newHost);
        }
    }

    // ========================================================================
    //  CALCULATIONS
    // ========================================================================

    public OptionalDouble calculateAverageVote(Room room) {
        Map<String, Double> nv = collectNumericVotes(room);
        return nv.values().stream().mapToDouble(Double::doubleValue).average();
    }

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

    public String calculateRange(Room room, Locale locale) {
        Map<String, Double> nv = collectNumericVotes(room);
        if (nv.isEmpty()) return null;
        double min = nv.values().stream().mapToDouble(Double::doubleValue).min().orElse(Double.NaN);
        double max = nv.values().stream().mapToDouble(Double::doubleValue).max().orElse(Double.NaN);
        if (Double.isNaN(min) || Double.isNaN(max)) return null;

        String minS = CardSequences.formatAverage(OptionalDouble.of(min), locale);
        String maxS = CardSequences.formatAverage(OptionalDouble.of(max), locale);
        return minS + "–" + maxS;
    }

    /** Consensus now fails immediately if any active participant selected ∞. */
    public boolean isConsensus(Room room) {
        if (room == null) return false;

        List<String> votes = new ArrayList<>();
        for (Participant p : room.getParticipants()) {
            if (p.isActive() && p.isParticipating()) {
                String v = p.getVote();
                if (v != null) votes.add(v);
            }
        }
        return com.example.estpoker.model.CardSequences.isConsensus(votes);
    }

    /** Detects at least one active, participating vote of ∞. */
    private boolean hasInfinityVote(Room room) {
        if (room == null) return false;
        for (Participant p : room.getParticipants()) {
            if (!p.isActive() || !p.isParticipating()) continue;
            String v = p.getVote();
            if (v == null) continue;
            if ("∞".equals(v) || "♾".equals(v) || "♾️".equals(v)) return true;
        }
        return false;
    }

    private Map<String, Double> collectNumericVotes(Room room) {
        Map<String, Double> out = new LinkedHashMap<>();
        if (room == null) return out;
        Set<String> seen = new HashSet<>();
        for (Participant p : room.getParticipants()) {
            if (!p.isActive() || !p.isParticipating()) continue;
            if (!seen.add(p.getName())) continue;
            String v = p.getVote();
            OptionalDouble num = CardSequences.parseNumeric(v); // specials (incl. ∞) -> empty
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

    // ========================================================================
    //  ROOM STATE JSON / SENDERS
    // ========================================================================

    /** Build the full room-state JSON payload once so both broadcast and targeted send can reuse it. */
    private String buildRoomStateJson(Room room) throws IOException {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "voteUpdate");

        List<Participant> ordered = getOrderedParticipants(room);
        Map<String, Map<String, Object>> byName = new LinkedHashMap<>();
        for (Participant p : ordered) {
            Map<String, Object> cur = byName.get(p.getName());
            boolean away = pendingDisconnects.containsKey(key(room, p.getName()));
            if (cur == null) {
                cur = new HashMap<>();
                cur.put("name", p.getName());
                cur.put("vote", p.getVote());
                cur.put("disconnected", !p.isActive());
                cur.put("away", away);
                cur.put("isHost", p.isHost());
                cur.put("participating", p.isParticipating());
                byName.put(p.getName(), cur);
            } else {
                if (p.getVote() != null) cur.put("vote", p.getVote());
                if (p.isHost()) cur.put("isHost", true);
                if (p.isParticipating()) cur.put("participating", true);
                if (p.isActive()) cur.put("disconnected", false);
                if (!away) cur.put("away", false);
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

        Map<String, Double> numeric = collectNumericVotes(room);
        int n = numeric.size();

        if (revealed && n >= 2) {
            OptionalDouble med = calculateMedian(room);
            payload.put("medianVote", med.isPresent() ? CardSequences.formatAverage(med, loc) : null);

            String range = calculateRange(room, loc);
            payload.put("range", range);
        } else {
            payload.put("medianVote", null);
            payload.put("range", null);
        }

        boolean consensus = revealed && isConsensus(room);
        payload.put("consensus", consensus);

        if (revealed && n >= 3) {
            List<String> outliers = farthestFromAverageNames(room);
            payload.put("outliers", outliers);
        } else {
            payload.put("outliers", List.of());
        }

        // infinity annotation for UI "(+ ♾️)"
        payload.put("hasInfinity", revealed && hasInfinityVote(room));

        payload.put("sequenceId", room.getSequenceId());
        payload.put("cards", room.getCurrentCards());
        payload.put("specials", CardSequences.SPECIALS);
        payload.put("autoRevealEnabled", room.isAutoRevealEnabled());
        payload.put("allowSpecials", room.isAllowSpecials());

        payload.put("topicLabel", room.getTopicLabel());
        payload.put("topicUrl", room.getTopicUrl());
        payload.put("topicVisible", room.isTopicVisible());

        payload.put("specialsEnabled", room.isAllowSpecials());

        return objectMapper.writeValueAsString(payload);
    }

    /** Send full room state to everyone in the room (kept for compatibility). */
    public void broadcastRoomState(Room room) {
        try {
            String json = buildRoomStateJson(room);
            broadcastToRoom(room, json);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    /** Targeted: send full room state only to the given session. */
    public void sendRoomState(WebSocketSession session, Room room) {
        if (session == null || room == null) return;
        try {
            String json = buildRoomStateJson(room);
            if (session.isOpen()) session.sendMessage(new TextMessage(json));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    // Aliases for reflection/back-compat used by GameWebSocketHandler
    public void sendRoomState(Room room, WebSocketSession session) { sendRoomState(session, room); }
    public void sendRoomSnapshot(WebSocketSession session, Room room) { sendRoomState(session, room); }
    public void sendStateTo(WebSocketSession session, Room room) { sendRoomState(session, room); }
    public void sendStateTo(WebSocketSession session, String roomCode) {
        Room r = getRoom(roomCode);
        if (r != null) sendRoomState(session, r);
    }
    public void broadcastRoom(Room room) { broadcastRoomState(room); }
    public void broadcast(Room room) { broadcastRoomState(room); }

    /** Low-level broadcast utility. */
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

    public void broadcastHostChange(Room room, String oldHostName, String newHostName) {
        try {
            Map<String, Object> legacy = new HashMap<>();
            legacy.put("type", "hostChanged");
            legacy.put("oldHost", oldHostName);
            legacy.put("newHost", newHostName);
            broadcastToRoom(room, objectMapper.writeValueAsString(legacy));
        } catch (IOException ignored) {}

        Map<String, Object> modern = new HashMap<>();
        modern.put("type", "hostTransferred");
        modern.put("from", oldHostName);
        modern.put("to", newHostName);
        try {
            broadcastToRoom(room, objectMapper.writeValueAsString(modern));
        } catch (Exception ignored) { }
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

    // ========================================================================
    //  DISCONNECTS / KICK / CLOSE
    // ========================================================================

    private void cancelPresenceTimers(Room room, String participantName) {
        String k = key(room, participantName);
        ScheduledFuture<?> f = pendingDisconnects.remove(k);
        if (f != null) f.cancel(false);

        ScheduledFuture<?> h = pendingHostTransfers.remove(k);
        if (h != null) h.cancel(false);
    }

    public void cancelPendingDisconnect(Room room, String participantName) {
        cancelPresenceTimers(room, participantName);
    }

    public void scheduleDisconnect(Room room, String participantName) {
        schedulePresence(room, participantName, LEAVE_GRACE_MS, HOST_GRACE_UNEXPECTED_MS);
    }

    public void scheduleIntentionalDisconnect(Room room, String participantName) {
        if (room == null || participantName == null) return;

        cancelPresenceTimers(room, participantName);

        broadcastParticipantLeft(room, participantName);

        synchronized (room) {
            Participant p = room.getParticipant(participantName);
            if (p != null) p.setActive(false);
        }
        broadcastRoomState(room);
        snapshot(room, participantName);

        scheduleHostTransfer(room, participantName, HOST_GRACE_INTENTIONAL_MS);
    }

    public void handleIntentionalLeave(String roomCode, String participantName) {
        Room room = getRoom(roomCode);
        if (room != null && participantName != null) {
            scheduleIntentionalDisconnect(room, participantName);
        }
    }

    private void schedulePresence(Room room, String participantName, long leaveDelayMs, long hostDelayMs) {
        if (room == null || participantName == null) return;
        String k = key(room, participantName);

        cancelPresenceTimers(room, participantName);

        broadcastRoomState(room);

        ScheduledFuture<?> leaveF = scheduler.schedule(() -> {
            try {
                synchronized (room) {
                    Participant participant = room.getParticipant(participantName);
                    if (participant != null) participant.setActive(false);
                }
                broadcastParticipantLeft(room, participantName);
                broadcastRoomState(room);
                snapshot(room, participantName);
            } finally {
                pendingDisconnects.remove(k);
            }
        }, leaveDelayMs, TimeUnit.MILLISECONDS);
        pendingDisconnects.put(k, leaveF);

        scheduleHostTransfer(room, participantName, hostDelayMs);
    }

    private void scheduleHostTransfer(Room room, String leavingName, long delayMs) {
        if (room == null || leavingName == null) return;
        String k = key(room, leavingName);

        ScheduledFuture<?> hostF = scheduler.schedule(() -> {
            try {
                String newHostName = null;
                synchronized (room) {
                    Participant host = room.getHost();
                    if (host != null && Objects.equals(host.getName(), leavingName)) {
                        host.setHost(false);
                        newHostName = room.assignNewHostIfNecessary(leavingName);
                    }
                }
                if (newHostName != null) {
                    broadcastHostChange(room, leavingName, newHostName);
                    broadcastRoomState(room);
                    snapshot(room, newHostName);
                }
            } finally {
                pendingHostTransfers.remove(k);
            }
        }, delayMs, TimeUnit.MILLISECONDS);

        pendingHostTransfers.put(k, hostF);
    }

    private void broadcastParticipantLeft(Room room, String name) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "participantLeft");
        payload.put("name", name);
        try {
            broadcastToRoom(room, objectMapper.writeValueAsString(payload));
        } catch (IOException ignored) { }
    }

    private void broadcastParticipantRenamed(Room room, String from, String to) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "participantRenamed");
        payload.put("from", from);
        payload.put("to", to);
        try {
            broadcastToRoom(room, objectMapper.writeValueAsString(payload));
        } catch (IOException ignored) { }
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

        cancelPresenceTimers(room, targetName);
        room.removeParticipant(targetName);

        String newHost = room.assignNewHostIfNecessary(targetName);
        if (newHost != null) broadcastHostChange(room, targetName, newHost);

        broadcastRoomState(room);
        snapshot(room, targetName);
    }

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

        for (Participant p : new ArrayList<>(room.getParticipants())) cancelPresenceTimers(room, p.getName());
        rooms.remove(room.getCode());
    }

    // ========================================================================
    //  IDENTITY PING
    // ========================================================================

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

    // ========================================================================
    //  TOPIC PARSING
    // ========================================================================

    private static final Pattern JIRA_KEY = Pattern.compile("\\b([A-Z][A-Z0-9]+-\\d+)\\b");

    private static String[] parseTopic(String input) {
        if (input == null) return new String[]{null, null};
        String s = input.trim();
        if (s.isEmpty()) return new String[]{null, null};

        boolean isUrl = s.startsWith("http://") || s.startsWith("https://");
        String url = isUrl ? s : null;

        String label;
        Matcher m = JIRA_KEY.matcher(s);
        if (m.find()) label = m.group(1);
        else label = s.length() > 140 ? s.substring(0, 140) + "…" : s;

        return new String[]{label, url};
    }

    // ========================================================================
    //  MISC HELPERS
    // ========================================================================

    private static String sanitizeSequenceId(String id) {
        if (id == null) return "fib.scrum";
        String s = id.trim().toLowerCase(Locale.ROOT);
        if (s.equals("fib-scrum")) s = "fib.scrum";
        if (s.equals("fib-enh"))   s = "fib.enh";
        if (s.equals("fib-math"))  s = "fib.math";
        if (s.equals("t-shirt"))   s = "tshirt";
        switch (s) {
            case "fib.scrum":
            case "fib.enh":
            case "fib.math":
            case "pow2":
            case "tshirt":
                return s;
            default:
                return "fib.scrum";
        }
    }

    // At least this many numeric voters required before returning tied outliers
    private static final int MIN_VOTERS_FOR_TIED_OUTLIERS = 5;

    /**
     * Names farthest from the average (numeric votes only, ≥3 voters required).
     * - If there is a single clear farthest voter → return that one.
     * - If several voters are tied for farthest → only return them when there are ≥ MIN_VOTERS_FOR_TIED_OUTLIERS
     *   numeric voters; otherwise return an empty list (no outliers).
     */
    public List<String> farthestFromAverageNames(Room room) {
        Map<String, Double> nv = collectNumericVotes(room);
        int n = nv.size();
        if (n < 3) return List.of();

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
        if (maxDist <= 0) return List.of(); // all equal → no outliers

        final double eps = 1e-9;
        List<String> tied = new ArrayList<>();
        for (Map.Entry<String, Double> e : dist.entrySet()) {
            if (Math.abs(e.getValue() - maxDist) <= eps) tied.add(e.getKey());
        }

        if (tied.size() == 1) return tied;                     // exactly one outlier
        return (n >= MIN_VOTERS_FOR_TIED_OUTLIERS) ? tied : List.of(); // multiple: require n >= 5
    }
}
