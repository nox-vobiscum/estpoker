package com.example.estpoker.model;

import java.util.Objects;

/** Simple participant model used by GameService and Room. */
public class Participant {

    private final String name;
    private String vote;                 // current vote token
    private boolean active = true;       // considered connected/active by server
    private boolean participating = true;// false => observer
    private boolean host = false;        // host flag
    private volatile long lastSeenAt = System.currentTimeMillis(); // heartbeat

    public Participant(String name) {
        this.name = Objects.requireNonNull(name, "name");
    }

    // identity
    public String getName() { return name; }

    // vote
    public String getVote() { return vote; }
    public void setVote(String vote) { this.vote = vote; }

    // presence
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public long getLastSeenAt() { return lastSeenAt; }
    public void bumpLastSeen() { this.lastSeenAt = System.currentTimeMillis(); }

    // roles
    public boolean isParticipating() { return participating; }
    public void setParticipating(boolean participating) { this.participating = participating; }

    public boolean isHost() { return host; }
    public void setHost(boolean host) { this.host = host; }

    @Override
    public String toString() {
        return "Participant{" +
                "name='" + name + '\'' +
                ", vote='" + vote + '\'' +
                ", active=" + active +
                ", participating=" + participating +
                ", host=" + host +
                ", lastSeenAt=" + lastSeenAt +
                '}';
    }
}
