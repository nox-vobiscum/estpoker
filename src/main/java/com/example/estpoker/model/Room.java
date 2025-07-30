package com.example.estpoker.model;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class Room {

    private String code;
    private List<Participant> participants;
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

    public void revealVotes() {
        this.votesRevealed = true;
    }

    public void resetVotes() {
        this.votesRevealed = false;
        for (Participant p : participants) {
            p.setVote(null);
        }
    }

    public Participant getHost() {
        return host;
    }

    public void setHost(Participant host) {
        this.host = host;
    }

    public Participant getOrCreateParticipant(String name) {
        for (Participant p : participants) {
            if (p.getName().equals(name)) {
                return p;
            }
        }
        Participant newParticipant = new Participant(name);
        participants.add(newParticipant);
        if (participants.size() == 1) {
            setHost(newParticipant);
        }
        return newParticipant;
    }

    public Participant getParticipant(String name) {
        return participants.stream()
                .filter(p -> p.getName().equals(name))
                .findFirst()
                .orElse(null);
    }

    public void storeCardValue(String participantName, String cardValue) {
        Participant participant = getOrCreateParticipant(participantName);
        participant.setVote(cardValue);
    }
}
