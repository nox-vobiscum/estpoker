package com.example.estpoker.model;

public class Participant {
    private final String name;
    private String vote;
    private boolean active = true;
    private boolean disconnected = false;
    private boolean isHost = false; // 🆕 NEU

    public Participant(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }

    public String getVote() {
        return vote;
    }

    public void setVote(String vote) {
        this.vote = vote;
    }

    public void setCard(String card) {
        this.vote = card;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public boolean isDisconnected() {
        return disconnected;
    }

    public void setDisconnected(boolean disconnected) {
        this.disconnected = disconnected;
    }

    public boolean isHost() {
        return isHost;
    }

    public void setHost(boolean host) {
        isHost = host;
    }
}
