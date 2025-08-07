package com.example.estpoker.model;

import java.util.*;

public class Room {

    private final String code;
    private final List<Participant> participants = new ArrayList<>();
    private final Map<String, Participant> nameToParticipant = new HashMap<>();
    private boolean votesRevealed = false;
    private Participant host;

    public Room(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

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

    public synchronized void setCardsRevealed(boolean revealed) {
        this.votesRevealed = revealed;
    }

    public synchronized boolean areVotesRevealed() {
        return votesRevealed;
    }

    public synchronized Participant getHost() {
        return host;
    }

    public synchronized void reset() {
        votesRevealed = false;
        for (Participant p : participants) {
            p.setVote(null);
        }
    }

    public synchronized void markInactive(String name) {
        Participant p = nameToParticipant.get(name);
        if (p != null) p.setActive(false);
    }

    public synchronized void markActive(String name) {
        Participant p = nameToParticipant.get(name);
        if (p != null) p.setActive(true);
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
        for (Participant p : participants) {
            if (p.getVote() != null) {
                voted.add(p);
            }
        }
        return voted;
    }

    public synchronized void addOrReactivateParticipant(String name) {
        Participant p = nameToParticipant.get(name);
        if (p == null) {
            p = new Participant(name);
            participants.add(p);
            nameToParticipant.put(name, p);

            // 👇 Wenn es noch keinen Host gibt, wird dieser Teilnehmer zum Host
            if (host == null) {
                host = p;
                p.setHost(true);
            }
        }
        p.setActive(true);
    }
}
