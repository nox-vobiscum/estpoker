package com.example.estpoker.model;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/** In-memory room state. Thread-safe enough when external code synchronizes on the Room instance. */
public class Room {

    private final String code;

    // Participants kept in insertion order (host may be bubbled in UI separately by service)
    private final List<Participant> participants = new CopyOnWriteArrayList<>();

    // Voting state
    private boolean cardsRevealed = false;

    // Deck / sequence
    private String sequenceId = "fib.scrum";
    // We keep a concrete snapshot of cards so the service can publish them directly.
    private List<String> currentCards = defaultDeckFor(sequenceId);

    // Auto-reveal
    private boolean autoRevealEnabled = false;

    // Topic / JIRA
    private String topicLabel;
    private String topicUrl;
    private boolean topicVisible = false;

    // Stable Client-ID (cid) -> participant name mapping (prevents duplicates on refresh)
    private final Map<String, String> cidToName = new ConcurrentHashMap<>();

    public Room(String code) {
        this.code = Objects.requireNonNull(code, "code");
    }

    public String getCode() { return code; }

    // --- participants ---
    public List<Participant> getParticipants() { return participants; }

    public Participant getParticipant(String name) {
        if (name == null) return null;
        for (Participant p : participants) {
            if (name.equals(p.getName())) return p;
        }
        return null;
    }

    public void addParticipant(Participant p) {
    if (p == null) return;
    // de-dupe by name: if the name is already taken, DO NOT touch the existing participant.
    Participant existing = getParticipant(p.getName());
    if (existing == null) {
        participants.add(p);
        return;
    }
    // Name already in use by someone else:
    // Intentionally no-op to avoid altering room state of the existing participant.
    // (Re-joins / refreshes should be handled via CID mapping elsewhere, not by name.)
}

    public void removeParticipant(String name) {
        if (name == null) return;
        participants.removeIf(p -> name.equals(p.getName()));
        // also drop any cid mappings pointing to this name
        cidToName.entrySet().removeIf(e -> name.equals(e.getValue()));
    }

    public Participant getHost() {
        for (Participant p : participants) {
            if (p.isHost()) return p;
        }
        return null;
    }

    /**
     * Ensure there is a host. If the given leavingName was host OR no host OR host inactive,
     * promote the first active participant (fallback: any participant). Returns new host name or null.
     */
    public String assignNewHostIfNecessary(String leavingName) {
        Participant host = getHost();
        boolean needNew =
                host == null ||
                !host.isActive() ||
                (leavingName != null && host.getName().equals(leavingName));

        if (!needNew) return null;

        // clear host flags first
        for (Participant p : participants) p.setHost(false);

        // prefer active & participating, then active, then anyone
        Participant candidate = null;

        for (Participant p : participants) {
            if (p.isActive() && p.isParticipating()) { candidate = p; break; }
        }
        if (candidate == null) {
            for (Participant p : participants) {
                if (p.isActive()) { candidate = p; break; }
            }
        }
        if (candidate == null && !participants.isEmpty()) {
            candidate = participants.get(0);
        }

        if (candidate != null) {
            candidate.setHost(true);
            return candidate.getName();
        }
        return null;
    }

    // == Specials visibility (room-wide) ==
    private volatile boolean allowSpecials = true;

    public boolean isAllowSpecials() {
        return allowSpecials;
    }

    public void setAllowSpecials(boolean allowSpecials) {
        this.allowSpecials = allowSpecials;
    }


    // --- voting / reveal ---
    public boolean areVotesRevealed() { return cardsRevealed; }
    public void setCardsRevealed(boolean revealed) { this.cardsRevealed = revealed; }

    /** Alias for handler compatibility. */
    public boolean isVotesRevealed() { return areVotesRevealed(); }

    /** Reset votes for a new round and hide results. */
    public void reset() {
        for (Participant p : participants) p.setVote(null);
        this.cardsRevealed = false;
    }

    // --- sequence / cards ---
    public String getSequenceId() { return sequenceId; }

    public void setSequenceId(String sequenceId) {
        if (sequenceId == null || sequenceId.isBlank()) return;
        this.sequenceId = sequenceId;
        this.currentCards = defaultDeckFor(sequenceId);
    }

    public List<String> getCurrentCards() { return currentCards; }

    /** Alias for handler compatibility. */
    public List<String> getCards() { return getCurrentCards(); }

    // --- auto reveal ---
    public boolean isAutoRevealEnabled() { return autoRevealEnabled; }
    public void setAutoRevealEnabled(boolean autoRevealEnabled) { this.autoRevealEnabled = autoRevealEnabled; }

    // --- topic ---
    public String getTopicLabel() { return topicLabel; }
    public void setTopicLabel(String topicLabel) { this.topicLabel = topicLabel; }

    public String getTopicUrl() { return topicUrl; }
    public void setTopicUrl(String topicUrl) { this.topicUrl = topicUrl; }

    public boolean isTopicVisible() { return topicVisible; }
    public void setTopicVisible(boolean topicVisible) { this.topicVisible = topicVisible; }

    /** Aliases for handler compatibility. */
    public boolean isTopicEnabled() { return isTopicVisible(); }
    public String getTopic() { return topicLabel != null ? topicLabel : ""; }

    // --- cid mapping (used by handler to resolve canonical name after join) ---
    /** Link a stable client id to a participant name. */
    public void linkCid(String cid, String name) {
        if (cid == null || name == null) return;
        cidToName.put(cid, name);
    }

    /** Remove a cid mapping (e.g., on final disconnect). */
    public void unlinkCid(String cid) {
        if (cid == null) return;
        cidToName.remove(cid);
    }

    /** Lookup participant by cid (if known). */
    public Optional<Participant> getParticipantByCid(String cid) {
        if (cid == null) return Optional.empty();
        String name = cidToName.get(cid);
        if (name == null) return Optional.empty();
        return Optional.ofNullable(getParticipant(name));
    }

    // --- name utilities for collision-safe rename ---------------------------------------------

    /** Quick helper: is a name already taken in this room (by any participant object). */
    public boolean nameInUse(String name) {
        return getParticipant(name) != null;
    }

    /**
     * Ensure a unique display name inside this room. If the desired name is free, returns it.
     * Otherwise returns "Name (2)", "Name (3)", ... (first available). This is pure logic;
     * callers should still apply CID-based reuse to avoid incrementing on reloads.
     */
    public String ensureUniqueName(String desired) {
        if (desired == null || desired.isBlank()) return "Guest";
        String base = desired.trim();

        if (!nameInUse(base)) return base;

        // If desired already has a " (n)" suffix, strip it for base to avoid "Name (2) (2)"
        String root = stripNumericSuffix(base);

        // Try root, then root (2..99)
        if (!nameInUse(root)) return root;
        for (int i = 2; i <= 99; i++) {
            String cand = root + " (" + i + ")";
            if (!nameInUse(cand)) return cand;
        }
        // Fallback if >99 duplicates (extremely unlikely)
        for (int i = 100; i <= 999; i++) {
            String cand = root + " (" + i + ")";
            if (!nameInUse(cand)) return cand;
        }
        // Last resort
        return root + " (uniq)";
    }

    /** Strip a trailing " (number)" suffix if present. E.g., "Roland (3)" -> "Roland". */
    private static String stripNumericSuffix(String s) {
        int len = s.length();
        if (len < 4) return s;
        // Very small parser: endsWith ')' and has ' (' somewhere before; digits in between.
        if (s.charAt(len - 1) != ')') return s;
        int open = s.lastIndexOf(" (");
        if (open < 0) return s;
        String inside = s.substring(open + 2, len - 1);
        if (inside.isEmpty()) return s;
        for (int i = 0; i < inside.length(); i++) {
            if (!Character.isDigit(inside.charAt(i))) return s;
        }
        // Looks like a numeric suffix -> strip it
        return s.substring(0, open);
    }

    /**
     * Rename a participant object identified by its current name to a new (collision-safe) name.
     * Properties (vote, activity, host flag, participation) are preserved. CID→name mappings are
     * updated atomically so that all tabs of the same CID still point to the same person.
     *
     * @param oldName   current name of the participant
     * @param desired   requested new display name (will be uniquified if needed)
     * @return the final/canonical name, or null if the old participant was not found
     */
    public String renameParticipant(String oldName, String desired) {
        if (oldName == null) return null;
        Participant current = getParticipant(oldName);
        if (current == null) return null;

        // If the name does not actually change, keep it (avoid pointless churn)
        if (Objects.equals(oldName, desired)) return oldName;

        String finalName = ensureUniqueName(desired);

        // If the final target equals the current, nothing to do
        if (Objects.equals(oldName, finalName)) return oldName;

        // If a participant with finalName already exists, merge into it to avoid duplicates.
        Participant target = getParticipant(finalName);
        if (target == null) {
            // Create a new participant object with the final name and copy state
            target = new Participant(finalName);
            target.setActive(current.isActive());
            target.setParticipating(current.isParticipating());
            target.setHost(current.isHost());
            target.setVote(current.getVote());
            // We do not copy timestamps; they will be refreshed by service on touch/join.
            // Replace current in list (preserve insertion order roughly by placing at current's index)
            int idx = participants.indexOf(current);
            if (idx >= 0) {
                participants.set(idx, target);
            } else {
                // Fallback: remove and append
                participants.remove(current);
                participants.add(target);
            }
        } else {
            // Merge current into existing target (preserve host/active/participation/vote)
            if (current.isHost()) target.setHost(true);
            if (current.isActive()) target.setActive(true);
            if (current.isParticipating()) target.setParticipating(true);
            if (target.getVote() == null && current.getVote() != null) {
                target.setVote(current.getVote());
            }
            // Remove the old object from the list
            participants.remove(current);
        }

        // Rewrite CID→name mappings from oldName to finalName so all tabs still point to this person.
        for (Map.Entry<String, String> e : cidToName.entrySet()) {
            if (Objects.equals(e.getValue(), oldName)) {
                e.setValue(finalName);
            }
        }

        return finalName;
    }

    // --- derived stats (on-the-fly, for handler convenience) ---
    /**
     * Average as display string if revealed; otherwise null.
     * Uses only active & participating voters with a numeric/non-special vote.
     */
    public String getAverage() {
        if (!cardsRevealed) return null;

        // collect valid votes
        Set<String> seen = new HashSet<>();
        List<String> votes = new ArrayList<>();
        for (Participant p : participants) {
            if (p.isActive() && p.isParticipating() && seen.add(p.getName())) {
                String v = p.getVote();
                if (v != null && !CardSequences.SPECIALS.contains(v)) votes.add(v);
            }
        }

        OptionalDouble avg = CardSequences.averageOfStrings(votes);
        return avg.isPresent() ? CardSequences.formatAverage(avg, Locale.getDefault()) : null;
    }

    // --- helpers ---
    private static List<String> defaultDeckFor(String id) {
        // Keep it simple and self-contained; your CardSequences handles average/formatting separately.
        // You can wire this to CardSequences if you already expose a deck lookup there.
        switch (String.valueOf(id)) {
            case "fib.math":
                return Arrays.asList("0","1","2","3","5","8","13","21","34","55");
            case "pow2":
                return Arrays.asList("2","4","8","16","32","64","128");
            case "tshirt":
                return Arrays.asList("XXS","XS","S","M","L","XL","XXL","XXXL");
            case "fib.enh":
                return Arrays.asList("0","½","1","2","3","5","8","13","20","40","100","♾️");
            case "fib.scrum":
            default:
                return Arrays.asList("1","2","3","5","8","13","20","40","100");
        }
    }
}
