package com.example.estpoker.model;

import java.util.*;

/**
 * Room state incl. participants, host handling and card sequence.
 */
public class Room {

    private final String code;

    private final List<Participant> participants = new ArrayList<>();
    private final Map<String, Participant> nameToParticipant = new HashMap<>();

    private boolean votesRevealed = false;
    private Participant host;

    // ===== Card sequence (server-managed) =====
    private String sequenceId = "fib-scrum";
    private List<String> currentCards = computeDeck(sequenceId);

    // Base sequences (numbers already in ascending order)
    private static final Map<String, List<String>> SEQ_BASE = Map.of(
            "fib-math",  List.of("0","1","2","3","5","8","13","21","34","55"),
            "fib-scrum", List.of("1","2","3","5","8","13","20","40"),
            "fib-enh",   List.of("0","½","1","2","3","5","8","13","20","40"),
            "pow2",      List.of("2","4","8","16","32","64","128"),
            "tshirt",    List.of("XXS","XS","S","M","L","XL","XXL","XXXL")
    );
    // (Lokale SPECIALS entfernt – zentrale Quelle ist CardSequences.SPECIALS)

    public Room(String code) {
        this.code = code;
    }

    /* ------------ Sequence helpers ------------ */

    private static List<String> computeDeck(String seqId) {
        List<String> base = new ArrayList<>(SEQ_BASE.getOrDefault(seqId, SEQ_BASE.get("fib-scrum")));
        // keep given order; append specials as own trailing "row"
        List<String> out = new ArrayList<>(base.size() + CardSequences.SPECIALS.size());
        out.addAll(base);
        out.addAll(CardSequences.SPECIALS); // zentrale Reihenfolge
        return out;
    }

    /** Sets the active sequence (unknown id falls back to "fib-scrum") and resets votes. */
    public synchronized void setSequence(String seqId) {
        if (!SEQ_BASE.containsKey(seqId)) {
            seqId = "fib-scrum";
        }
        this.sequenceId = seqId;
        this.currentCards = computeDeck(seqId);
        reset(); // start a fresh round when sequence changes
    }

    public synchronized String getSequenceId() {
        return sequenceId;
    }

    /** Current deck (base + specials). A copy is returned to keep internal list immutable. */
    public synchronized List<String> getCurrentCards() {
        return new ArrayList<>(currentCards);
    }

    /* ------------ Basic room info ------------ */

    public String getCode() { return code; }

    public synchronized void addParticipant(Participant p, boolean asHost) {
        nameToParticipant.put(p.getName(), p);
        participants.add(p);
        if (asHost) {
            host = p;
            p.setHost(true);
        }
    }

    public synchronized Participant getParticipant(String name) {
        return nameToParticipant.get(name);
    }

    public synchronized List<Participant> getParticipants() {
        return participants;
    }

    public synchronized void setCardsRevealed(boolean revealed) { this.votesRevealed = revealed; }
    public synchronized boolean areVotesRevealed() { return votesRevealed; }

    public synchronized Participant getHost() { return host; }

    public synchronized void reset() {
        votesRevealed = false;
        for (Participant p : participants) {
            p.setVote(null);
        }
    }

    public synchronized void markInactive(String name) {
        Participant p = nameToParticipant.get(name);
        if (p != null) {
            p.setActive(false);
            p.setDisconnected(true);
        }
    }

    public synchronized void markActive(String name) {
        Participant p = nameToParticipant.get(name);
        if (p != null) {
            p.setActive(true);
            p.setDisconnected(false);
        }
    }

    public synchronized void removeParticipant(String name) {
        Participant p = nameToParticipant.remove(name);
        if (p != null) {
            participants.remove(p);
            // Host re-assignment is handled by assignNewHostIfNecessary(...)
        }
    }

    public synchronized Participant getOrCreateParticipant(String name) {
        Participant p = nameToParticipant.get(name);
        if (p == null) {
            p = new Participant(name);
            participants.add(p);
            nameToParticipant.put(name, p);
        }
        return p;
    }

    public synchronized List<Participant> getParticipantsWithVotes() {
        List<Participant> voted = new ArrayList<>();
        for (Participant p : participants) {
            if (p.getVote() != null) voted.add(p);
        }
        return voted;
    }

    public synchronized void addOrReactivateParticipant(String name) {
        Participant p = nameToParticipant.get(name);
        if (p == null) {
            p = new Participant(name);
            participants.add(p);
            nameToParticipant.put(name, p);
        }
        p.setActive(true);
        p.setDisconnected(false);

        if (host == null) {
            host = p;
            p.setHost(true);
            System.out.println("👑 Neuer Host: " + p.getName());
        }
    }

    public synchronized String assignNewHostIfNecessary(String oldHostName) {
        if (host != null && host.getName().equals(oldHostName)) {
            for (Participant p : participants) {
                if (p.isActive() && !p.getName().equals(oldHostName)) {
                    host.setHost(false);
                    host = p;
                    p.setHost(true);
                    return p.getName();
                }
            }
        }
        return null;
    }

    // ===== Rename support (update map key + object name, avoid collisions) =====

    private String uniqueName(String desired) {
        String base = (desired == null || desired.isBlank()) ? "Guest" : desired;
        String candidate = base;
        int i = 2;
        while (nameToParticipant.containsKey(candidate)) {
            candidate = base + " (" + i + ")";
            i++;
        }
        return candidate;
    }

    /**
     * Renames a participant (keeps the same instance).
     * Returns the final used new name or null if oldName unknown.
     */
    public synchronized String renameParticipant(String oldName, String desiredNewName) {
        Participant p = nameToParticipant.remove(oldName);
        if (p == null) return null;

        String newName = desiredNewName;
        if (newName == null || newName.isBlank()) newName = oldName;

        // if actually changed and collides -> make unique
        if (!oldName.equals(newName) && nameToParticipant.containsKey(newName)) {
            newName = uniqueName(newName);
        }

        p.setName(newName);
        nameToParticipant.put(newName, p);
        return newName;
    }
}
