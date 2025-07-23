package com.example.estpoker.model;

import java.util.*;

public class Room {
    private String code;
    private Map<String, Participant> participants = new HashMap<>();
    private boolean revealed = false;

    public Room(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public Collection<Participant> getParticipants() {
        return participants.values();
    }

    public void addParticipant(String name) {
        if (!participants.containsKey(name)) {
            participants.put(name, new Participant(name));
        }
    }

    public Participant getParticipant(String name) {
        return participants.get(name);
    }

    public void setRevealed(boolean revealed) {
        this.revealed = revealed;
    }

    public boolean isRevealed() {
        return revealed;
    }

    public void resetVotes() {
        for (Participant p : participants.values()) {
            p.setCard(null);
        }
        revealed = false;
    }
}