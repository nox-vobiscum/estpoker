package com.example.estpoker.model;

import java.util.*;

public class Room {

    private final String code;
    private final List<Participant> participants = new ArrayList<>();
    private final Map<String, Participant> nameToParticipant = new HashMap<>();
    private boolean votesRevealed = false;
    private Participant host;

    // ==== Sequence support ====
    private String sequenceId = "fib-scrum";
    private List<String> currentDeck = new ArrayList<>();

    private static final Map<String, List<String>> SEQUENCES;
    private static final List<String> SPECIALS = Arrays.asList("❓","💬","☕");
    static {
        Map<String, List<String>> m = new HashMap<>();
        m.put("fib-orig",  Arrays.asList("0","1","2","3","5","8","13","21","34","55"));
        m.put("fib-scrum", Arrays.asList("1","2","3","5","8","13","20","40"));
        m.put("fib-enh",   Arrays.asList("0","1/2","1","2","3","5","8","13","20","40"));
        m.put("pow2",      Arrays.asList("2","4","8","16","32"));
        m.put("tshirt",    Arrays.asList("XS","S","M","L","XL","XXL","XXXL"));
        SEQUENCES = Collections.unmodifiableMap(m);
    }
    private void ensureDeckInit(){
        if (currentDeck.isEmpty()) setSequence(sequenceId);
    }
    public synchronized void setSequence(String id){
        if (id == null || !SEQUENCES.containsKey(id)) id = "fib-scrum";
        this.sequenceId = id;
        this.currentDeck = new ArrayList<>(SEQUENCES.get(id));
        this.currentDeck.addAll(SPECIALS);
        reset(); // neue Runde bei Wechsel
    }
    public synchronized String getSequenceId(){ ensureDeckInit(); return sequenceId; }
    public synchronized List<String> getDeck(){ ensureDeckInit(); return Collections.unmodifiableList(currentDeck); }

    // ==== existing logic ====
    public Room(String code) { this.code = code; }
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
        votesRevealed = false;
        for (Participant p : participants) { p.setVote(null); }
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
        if (p != null) {
            participants.remove(p);
            // Host change handled elsewhere if needed
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
        for (Participant p : participants) if (p.getVote() != null) voted.add(p);
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

    // rename support (keine Doppelten)
    private String uniqueName(String desired) {
        String base = (desired == null || desired.isBlank()) ? "Guest" : desired;
        String candidate = base; int i = 2;
        while (nameToParticipant.containsKey(candidate)) { candidate = base + " (" + i + ")"; i++; }
        return candidate;
    }
    public synchronized String renameParticipant(String oldName, String desiredNewName) {
        Participant p = nameToParticipant.remove(oldName);
        if (p == null) return null;
        String newName = desiredNewName;
        if (newName == null || newName.isBlank()) newName = oldName;
        if (!oldName.equals(newName) && nameToParticipant.containsKey(newName)) newName = uniqueName(newName);
        p.setName(newName);
        nameToParticipant.put(newName, p);
        return newName;
    }
}
