package com.example.estpoker.model;

public class Participant {
    private String name;            // <- not final to allow rename
    private String vote;
    private boolean active = true;
    private boolean disconnected = false;
    private boolean isHost = false; // host flag

    // NEW: participates in estimation (default true)
    private boolean participating = true;

    public Participant(String name) {
        this.name = name;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getVote() { return vote; }
    public void setVote(String vote) { this.vote = vote; }

    // legacy alias used elsewhere
    public void setCard(String card) { this.vote = card; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public boolean isDisconnected() { return disconnected; }
    public void setDisconnected(boolean disconnected) { this.disconnected = disconnected; }

    public boolean isHost() { return isHost; }
    public void setHost(boolean host) { isHost = host; }

    public boolean isParticipating() { return participating; }
    public void setParticipating(boolean participating) { this.participating = participating; }

    // convenience helpers (optional)
    public void markConnected() {
        this.active = true;
        this.disconnected = false;
    }

    public void markDisconnected() {
        this.active = false;
        this.disconnected = true;
    }
}
