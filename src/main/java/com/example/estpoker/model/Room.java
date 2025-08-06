package com.example.estpoker.model;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class Room {

    private final String code;
    private final List<Participant> participants;
    private boolean votesRevealed;
    private Participant host;

    public Room(String code) {
        this.code = code;
        this.participants = new ArrayList<>();
        this.votesRevealed = false;
    }

    public String getCode() {
        return code;
    }

    public List<Participant> getParticipants() {
        return participants;
    }

    public List<Participant> getParticipantsWithVotes() {
        return participants.stream()
                .filter(p -> p.getVote() != null)
                .collect(Collectors.toList());
    }

    public boolean areVotesRevealed() {
        return votesRevealed;
    }

    public void setCardsRevealed(boolean revealed) {
        this.votesRevealed = revealed;
    }

    public Participant getParticipant(String name) {
        return participants.stream()
                .filter(p -> p.getName().equals(name))
                .findFirst()
                .orElse(null);
    }

    public Participant getOrCreateParticipant(String name) {
        Participant existing = getParticipant(name);
        if (existing != null) {
            return existing;
        }
        Participant newParticipant = new Participant(name);
        participants.add(newParticipant);
        if (participants.size() == 1) {
            this.host = newParticipant;
        }
        return newParticipant;
    }

    public void addOrReactivateParticipant(String name) {
        Participant existing = getParticipant(name);
        if (existing != null) {
            existing.setActive(true);
        } else {
            participants.add(new Participant(name));
        }
    }

    public void reset() {
        this.votesRevealed = false;
        for (Participant p : participants) {
            p.setVote(null);
            // ⚠️ Nur auf true setzen, wenn tatsächlich verbunden
            // Teilnehmer bleibt "inaktiv", wenn er die WebSocket-Verbindung nicht mehr hat
        }
    }

    public Participant getHost() {
        return host;
    }
}
