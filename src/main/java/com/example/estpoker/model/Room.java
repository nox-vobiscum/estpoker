package com.example.estpoker.model;

import java.util.*;
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
        // de-dupe by name: update existing instead of adding a duplicate row
        Participant existing = getParticipant(p.getName());
        if (existing == null) {
            participants.add(p);
        } else {
            // merge minimal presence (keep existing object so references remain stable)
            existing.setActive(true);
            existing.setParticipating(p.isParticipating());
            if (p.isHost()) existing.setHost(true);
        }
    }

    public void removeParticipant(String name) {
        if (name == null) return;
        participants.removeIf(p -> name.equals(p.getName()));
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

    // --- voting / reveal ---
    public boolean areVotesRevealed() { return cardsRevealed; }
    public void setCardsRevealed(boolean revealed) { this.cardsRevealed = revealed; }

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

    // --- helpers ---
    private static List<String> defaultDeckFor(String id) {
        // Keep it simple and self-contained; your CardSequences handles average/formatting separately.
        // You can wire this to CardSequences if you already expose a deck lookup there.
        switch (String.valueOf(id)) {
            case "fib.math":
                return Arrays.asList("0","1","2","3","5","8","13","21","34","55","∞","☕");
            case "pow2":
                return Arrays.asList("2","4","8","16","32","64","128","∞","☕");
            case "tshirt":
                return Arrays.asList("XXS","XS","S","M","L","XL","XXL","XXXL","☕");
            case "fib.enh":
                return Arrays.asList("0","½","1","2","3","5","8","13","20","40","100","∞","☕");
            case "fib.scrum":
            default:
                return Arrays.asList("1","2","3","5","8","13","20","40","100","∞","☕");
        }
    }
}
