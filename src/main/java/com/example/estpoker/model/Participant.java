package com.example.estpoker.model;

public class Participant {
    private String name;
    private String vote;

    public Participant(String name) {
        this.name = name;
        this.vote = null;
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
}
