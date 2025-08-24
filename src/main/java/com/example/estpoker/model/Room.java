package com.example.estpoker.model;

import java.util.*;

/**
 * Room state incl. participants, host handling, card sequence and topic (ticket/story).
 */
public class Room {

    private final String code;

    private final List<Participant> participants = new ArrayList<>();
    private final Map<String, Participant> nameToParticipant = new HashMap<>();

    private boolean votesRevealed = false;
    private Participant host;

    // === Auto-Reveal per room ===
    private boolean autoRevealEnabled = false; // default: OFF

    // ===== Card sequence (delegated to CardSequences) =====
    private String sequenceId = CardSequences.DEFAULT_SEQUENCE_ID;
    private List<String> currentCards = safeDeck(sequenceId);

    // ===== Topic / Story (Ticket) =====
    private String topicLabel;   // e.g., "RBSEP-123" or free text
    private String topicUrl;     // optional JIRA (or any) URL
    private boolean topicVisible = true; // NEW: host can toggle visibility at runtime

    public Room(String code) { this.code = code; }

    /* ------------ Sequence helpers (delegation) ------------ */

    private static List<String> safeDeck(String seqId) {
        String normalized = CardSequences.normalizeSequenceId(seqId);
        List<String> deck = CardSequences.buildDeck(normalized);
        if (deck == null || deck.isEmpty()) {
            normalized = CardSequences.DEFAULT_SEQUENCE_ID;
            deck = CardSequences.buildDeck(normalized);
        }
        return deck;
    }

    /** Sets the active sequence and resets votes. Unknown IDs fall back to default. */
    public synchronized void setSequence(String seqId) {
        this.sequenceId = CardSequences.normalizeSequenceId(seqId);
        this.currentCards = safeDeck(this.sequenceId);
        reset();
    }

    public synchronized String getSequenceId() { return sequenceId; }
    public synchronized List<String> getCurrentCards() { return new ArrayList<>(currentCards); }

    /* ------------ Topic helpers ------------ */

    public synchronized String getTopicLabel() { return topicLabel; }
    public synchronized String getTopicUrl()   { return topicUrl; }

    /** Set or clear the topic (label and optional URL). Pass null/blank to clear fields. */
    public synchronized void setTopic(String label, String url) {
        this.topicLabel = (label == null || label.isBlank()) ? null : label.trim();
        this.topicUrl   = (url == null   || url.isBlank())   ? null : url.trim();
    }

    /** NEW: runtime visibility toggle controlled by host. */
    public synchronized boolean isTopicVisible() { return topicVisible; }
    public synchronized void setTopicVisible(boolean visible) { this.topicVisible = visible; }

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

    public synchronized Participant getParticipant(String name) { return nameToParticipant.get(name); }
    public synchronized List<Participant> getParticipants() { return participants; }

    public synchronized void setCardsRevealed(boolean revealed) { this.votesRevealed = revealed; }
    public synchronized boolean areVotesRevealed() { return votesRevealed; }

    public synchronized Participant getHost() { return host; }

    public synchronized void reset() {
        // Start a new round: hide results and clear all votes
        votesRevealed = false;
        for (Participant p : participants) p.setVote(null);

        // As discussed: clear the current topic when starting a fresh round
        // (visibility flag remains unchanged so the host preference persists)
        setTopic(null, null);
    }

    public synchronized void markInactive(String name) {
        Participant p = nameToParticipant.get(name);
        if (p != null) { p.setActive(false); p.setDisconnected(true); }
    }

    public synchronized void markActive(String name) {
        Participant p = nameToParticipant.get(name);
        if (p != null) { p.setActive(true); p.setDisconnected(false); }
    }

    public synchronized void removeParticipant(String name) {
        Participant p = nameToParticipant.remove(name);
        if (p != null) participants.remove(p);
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
        for (Participant p : participants) if (p.getVote() != null) voted.add(p);
        return voted;
    }

    /**
     * Add or reactivate a participant; if the name collides with an active participant,
     * create a new participant with a unique suffix (e.g., "Max (2)").
     * @return the final name used for this join
     */
    public synchronized String addOrReactivateParticipant(String desiredName) {
        String name = (desiredName == null || desiredName.isBlank()) ? "Guest" : desiredName;
        Participant existing = nameToParticipant.get(name);

        if (existing == null) {
            // fresh new participant
            Participant p = new Participant(name);
            p.setActive(true);
            p.setDisconnected(false);
            participants.add(p);
            nameToParticipant.put(name, p);
            if (host == null) { host = p; p.setHost(true); }
            return p.getName();
        }

        if (!existing.isActive()) {
            // re-activate the inactive one (same person likely)
            existing.setActive(true);
            existing.setDisconnected(false);
            if (host == null) { host = existing; existing.setHost(true); }
            return existing.getName();
        }

        // collision with an ACTIVE participant -> create a new unique participant
        String unique = uniqueName(name);
        Participant p = new Participant(unique);
        p.setActive(true);
        p.setDisconnected(false);
        participants.add(p);
        nameToParticipant.put(unique, p);
        if (host == null) { host = p; p.setHost(true); }
        return p.getName();
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

    /** Manual host transfer. true if successful. */
    public synchronized boolean transferHostTo(String newHostName) {
        Participant target = nameToParticipant.get(newHostName);
        if (target == null) return false;
        if (host != null && host.getName().equals(newHostName)) return false;
        if (host != null) host.setHost(false);
        host = target;
        target.setHost(true);
        return true;
    }

    // ===== Rename support =====

    private String uniqueName(String desired) {
        String base = (desired == null || desired.isBlank()) ? "Guest" : desired;
        String candidate = base; int i = 2;
        while (nameToParticipant.containsKey(candidate)) { candidate = base + " (" + i + ")"; i++; }
        return candidate;
    }

    public synchronized String renameParticipant(String oldName, String desiredNewName) {
        Participant p = nameToParticipant.remove(oldName);
        if (p == null) return null;
        String newName = (desiredNewName == null || desiredNewName.isBlank()) ? oldName : desiredNewName;
        if (!oldName.equals(newName) && nameToParticipant.containsKey(newName)) newName = uniqueName(newName);
        p.setName(newName);
        nameToParticipant.put(newName, p);
        return newName;
    }

    // === Auto-Reveal getter/setter ===
    public synchronized boolean isAutoRevealEnabled() { return autoRevealEnabled; }
    public synchronized void setAutoRevealEnabled(boolean on) { this.autoRevealEnabled = on; }
}
