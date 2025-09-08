package com.example.estpoker.service;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.model.CardSequences;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Game service: room state, participants, voting, topic, auto-reveal, host rotation. */
@Service
public class GameService {

    private static final Logger log = LoggerFactory.getLogger(GameService.class);

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

    // --- disconnect grace ---
    private static final long DISCONNECT_GRACE_MS = 120_000L; // long grace to avoid flapping
    private static final long INTENTIONAL_GRACE_MS = 2_000L;  // short grace for refresh/navigate

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

    // --- join (CID-bound) ------------------------------------------------------
    /**
     * Join a room with a given CID and requested display name.
     * If the CID already exists in the room, we keep that identity (ignore requestedName),
     * mark it active/participating, and broadcast. Otherwise we create a unique participant
     * (Name, Name (2), …), link the CID, and broadcast.
     */
    public Room join(String roomCode, String cid, String requestedName) {
        Room room = getOrCreateRoom(roomCode);
        String desired = normalizeName(requestedName);

        synchronized (room) {
            Participant byCid = room.getParticipantByCid(cid).orElse(null);
            if (byCid != null) {
                // Re-connect: keep existing display name for this CID
                byCid.setActive(true);
                byCid.setParticipating(true);
                byCid.bumpLastSeen();
                if (room.getHost() == null) byCid.setHost(true);
                rememberClientName(roomCode, cid, byCid.getName());
                cancelPendingDisconnect(room, byCid.getName()); // cancel any pending grace timer
            } else {
                // New CID → create/link a unique participant
                String unique = uniqueNameFor(room, desired, null);
                Participant p = new Participant(unique);
                p.setActive(true);
                p.setParticipating(true);
                p.bumpLastSeen();
                if (room.getHost() == null) p.setHost(true);

                room.addParticipant(p);
                room.linkCid(cid, unique);
                rememberClientName(roomCode, cid, unique);
            }
        }

        broadcastRoomState(room);
        return room;
    }

    // --- rename (CID-bound) ------------------------------------------------------

    /**
     * Rename the participant bound to a given CID within a room.
     * - Keeps identity stable by CID.
     * - Ensures uniqueness: "Name", "Name (2)", "Name (3)", …
     * - If desired equals current, it's a no-op.
     * Returns the final (possibly adjusted) name, or null if room not found.
     */
    public String renameParticipant(String roomCode, String cid, String requestedName) {
        Room room = getRoom(roomCode);
        if (room == null || cid == null) return null;

        String finalName;
        synchronized (room) {
            // Current participant for this CID (should exist after join)
            Participant cur = room.getParticipantByCid(cid).orElse(null);
            String currentName = (cur != null ? cur.getName() : null);

            String desired = (requestedName == null ? "" : requestedName.trim());
            if (desired.isEmpty()) desired = "Guest";

            if (cur == null) {
                // Fallback: unknown CID – behave like a fresh join with unique name
                String unique = uniqueNameFor(room, desired, null);
                Participant p = room.getParticipant(unique);
                if (p == null) {
                    p = new Participant(unique);
                    room.addParticipant(p);
                }
                room.linkCid(cid, p.getName());
                finalName = p.getName();
            } else {
                // CID known → rename this one, but keep uniqueness (exclude self)
                String unique = uniqueNameFor(room, desired, currentName);
                if (unique.equals(currentName)) {
                    finalName = currentName; // no-op
                } else {
                    // No setName() on Participant → create replacement and transfer minimal state
                    Participant repl = new Participant(unique);
                    repl.setActive(cur.isActive());
                    repl.setParticipating(cur.isParticipating());
                    repl.setHost(cur.isHost());
                    repl.setVote(cur.getVote());

                    // Insert replacement, re-link CID, remove old
                    room.addParticipant(repl);
                    room.linkCid(cid, unique);
                    room.removeParticipant(currentName);

                    finalName = unique;
                }
            }

            rememberClientName(roomCode, cid, finalName);
        }

        // Inform clients about the change
        broadcastRoomState(room);
        return finalName;
    }

    /** Produce a unique display name in the given room. If selfName != null, that name is ignored for collision checks. */
    private static String uniqueNameFor(Room room, String desired, String selfName) {
        String base = (desired == null || desired.isBlank()) ? "Guest" : desired.trim();
        String candidate = base;
        int suffix = 2;

        while (true) {
            Participant clash = room.getParticipant(candidate);
            if (clash == null || (selfName != null && selfName.equals(candidate))) {
                return candidate; // free or the same as self
            }
            candidate = base + " (" + suffix + ")";
            suffix++;
        }
    }

    /**
     * Public API used by the WS handler to rename by CID.
     * Returns the final (possibly uniquified) name.
     */
    public String renameByCid(String roomCode, String cid, String requestedName) {
        Room room = getOrCreateRoom(roomCode);
        String desired = normalizeName(requestedName);
        String finalName;

        synchronized (room) {
            Participant p = room.getParticipantByCid(cid).orElse(null);
            if (p == null) {
                // Unknown CID -> treat as join path
                join(roomCode, cid, desired);
                finalName = room.getParticipantByCid(cid).map(Participant::getName).orElse(desired);
            } else if (Objects.equals(p.getName(), desired)) {
                finalName = p.getName();
                room.linkCid(cid, finalName);
                rememberClientName(roomCode, cid, finalName);
                p.bumpLastSeen();
            } else {
                finalName = renameInternal(room, p.getName(), cid, desired);
            }
        }

        broadcastRoomState(room);
        return finalName;
    }

    /** Back-compat adapter in case older callers use gameService.rename(...). */
    public String rename(String roomCode, String cid, String requestedName) {
        return renameParticipant(roomCode, cid, requestedName);
    }

    /**
     * Internal rename without using setName (Participant has no name setter).
     * We remove the old participant, create a new one with the target name,
     * copy relevant flags/vote, link CID, and add back to the room.
     */
    private String renameInternal(Room room, String oldName, String cid, String desired) {
        String target = pickUniqueName(room, desired, oldName);
        if (Objects.equals(target, oldName)) {
            room.linkCid(cid, oldName);
            return oldName;
        }

        Participant old = room.getParticipant(oldName);
        if (old == null) {
            // Fallback: nothing to copy; just create a fresh participant
            Participant fresh = new Participant(target);
            fresh.setActive(true);
            fresh.setParticipating(true);
            fresh.bumpLastSeen();
            room.removeParticipant(oldName);
            room.addParticipant(fresh);
            room.linkCid(cid, target);
            return target;
        }

        // Snapshot flags to retain state over rename
        boolean wasHost = old.isHost();
        boolean active = old.isActive();
        boolean participating = old.isParticipating();
        String vote = old.getVote();

        // Replace object
        room.removeParticipant(oldName);
        Participant neo = new Participant(target);
        neo.setActive(active);
        neo.setParticipating(participating);
        neo.setVote(vote);
        neo.setHost(wasHost);
        neo.bumpLastSeen();

        room.addParticipant(neo);
        room.linkCid(cid, target);
        return target;
    }

    /** Ensure a human-friendly non-empty name; trim + clamp. */
    private static String normalizeName(String s) {
        String t = (s == null) ? "" : s.trim();
        if (t.isEmpty()) t = "Guest";
        if (t.length() > 80) t = t.substring(0, 80);
        return t;
    }

    /**
     * Pick a unique visible name inside the room.
     * If 'selfOldName' is provided, that name is considered "ours" and allowed.
     * Strategy: base, base (2), base (3) … (cap at 99, then add short suffix).
     */
    private static String pickUniqueName(Room room, String base, String selfOldName) {
        String candidate = base;
        int i = 2;
        while (true) {
            Participant clash = room.getParticipant(candidate);
            if (clash == null) return candidate;
            if (selfOldName != null && candidate.equals(selfOldName)) return candidate;
            if (i > 99) {
                // Emergency: avoid unbounded loops on pathological history
                String shortRand = UUID.randomUUID().toString().substring(0, 4);
                return base + " (" + shortRand + ")";
            }
            candidate = base + " (" + i + ")";
            i++;
        }
    }

    // ========================================================================
    //  PRESENCE / VOTE / TOPIC / SEQUENCE / HOSTING
    // ========================================================================

    /** Optional: explicitly mark connected (kept for completeness). */
    public void markConnected(String roomCode, String cid, boolean announce) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) {
            Participant p = room.getParticipantByCid(cid).orElse(null);
            if (p == null) {
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

    /** Set a vote (supports name or CID). */
    public void setVote(String roomCode, String nameOrCid, String value) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) {
            Participant p = room.getParticipantByCid(nameOrCid).orElse(null);
            if (p == null) p = room.getParticipant(nameOrCid);
            if (p == null) {
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

    /** Reveal cards explicitly. */
    public void reveal(String roomCode) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) { room.setCardsRevealed(true); }
        broadcastRoomState(room);
    }

    /** Start a new round. */
    public void reset(String roomCode) {
        Room room = getOrCreateRoom(roomCode);
        synchronized (room) { room.reset(); }
        broadcastRoomState(room);
    }

    /** Save topic (label+optional url) and show it. */
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

    /**
     * Toggle auto-reveal flag and broadcast.
     * If enabling and all votes are already present, reveal immediately.
     */
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
    }

    /**
     * Observer toggle (supports cid or name).
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

    /** Keep-alive ping from client (cid or name) to prevent false host demotion. */
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

    /** Change card sequence, reset round and broadcast. */
    public void setSequence(String roomCode, String sequenceId) {
        Room room = getOrCreateRoom(roomCode);
        String normalized = sanitizeSequenceId(sequenceId);
        synchronized (room) {
            room.setSequenceId(normalized);
            room.reset(); // clear votes because card set changed
        }
        broadcastRoomState(room);
    }

    /** Promote a participant to host (demote current host). */
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

    /** Ensure a host exists; if current host is inactive for longer than limits, promote someone else.
     *  softMs: advisory (no action), hardMs: demote & reassign.
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

    public boolean isConsensus(Room room) {
        Map<String, Double> nv = collectNumericVotes(room);
        if (nv.isEmpty()) return false;
        double first = nv.values().iterator().next();
        for (double v : nv.values()) {
            if (Double.compare(v, first) != 0) return false;
        }
        return true;
    }

    /** Names farthest from the average (only useful with ≥3 votes). */
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

    /** Collect numeric votes: active + participating, dedupe by name; specials (incl. ∞) ignored. */
    private Map<String, Double> collectNumericVotes(Room room) {
        Map<String, Double> out = new LinkedHashMap<>();
        if (room == null) return out;
        Set<String> seen = new HashSet<>();
        for (Participant p : room.getParticipants()) {
            if (!p.isActive() || !p.isParticipating()) continue;
            if (!seen.add(p.getName())) continue;
            String v = p.getVote();
            OptionalDouble num = CardSequences.parseNumeric(v); // ∞/specials -> empty
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
    //  BROADCAST / SNAPSHOTS
    // ========================================================================

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

            // Participants: host first; then dedupe by name into a single row
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

            payload.put("sequenceId", room.getSequenceId());
            payload.put("cards", room.getCurrentCards());
            payload.put("specials", CardSequences.SPECIALS);
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

    // ========================================================================
    //  DISCONNECTS / KICK / CLOSE
    // ========================================================================

    public void cancelPendingDisconnect(Room room, String participantName) {
        String k = key(room, participantName);
        ScheduledFuture<?> f = pendingDisconnects.remove(k);
        if (f != null) f.cancel(false);
    }

    /** Standard disconnect (network hiccup, background tab): long grace. */
    public void scheduleDisconnect(Room room, String participantName) {
        scheduleDisconnect(room, participantName, DISCONNECT_GRACE_MS);
    }

    /** Intentional leave (refresh/navigation): short grace. */
    public void scheduleIntentionalDisconnect(Room room, String participantName) {
        scheduleDisconnect(room, participantName, INTENTIONAL_GRACE_MS);
    }

    /** Back-compat wrapper for older controllers. */
    public void markLeftIntentionally(Room room, String participantName) {
        // Intentional leave should not immediately reshuffle host; use short grace.
        scheduleIntentionalDisconnect(room, participantName);
    }

    /** Back-compat wrapper used by GameWebSocketHandler (roomCode + name). */
    public void handleIntentionalLeave(String roomCode, String participantName) {
        Room room = getRoom(roomCode);
        if (room != null && participantName != null) {
            scheduleIntentionalDisconnect(room, participantName);
        }
    }

    private void scheduleDisconnect(Room room, String participantName, long delayMs) {
        if (room == null || participantName == null) return;
        String k = key(room, participantName);

        // Replace any existing timer for this person
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
        }, delayMs, TimeUnit.MILLISECONDS);

        pendingDisconnects.put(k, f);
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

    /** Returns [label, urlOrNull]. */
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

    /** Accept known sequence ids; normalize dash/dot variants; fallback to "fib.scrum". */
    private static String sanitizeSequenceId(String id) {
        if (id == null) return "fib.scrum";
        String s = id.trim().toLowerCase(Locale.ROOT);
        // normalize common variants
        if (s.equals("fib-scrum")) s = "fib.scrum";
        if (s.equals("fib-enh"))   s = "fib.enh";
        if (s.equals("fib-math"))  s = "fib.math";
        if (s.equals("t-shirt"))   s = "tshirt";
        // whitelist
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
}
