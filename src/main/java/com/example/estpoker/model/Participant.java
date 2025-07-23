package com.example.estpoker.model;

public class Participant {
    private String name;
    private String card; // z. B. "5", "☕", "?"

    public Participant(String name) {
        this.name = name;
        this.card = null;
    }

    public String getName() {
        return name;
    }

    public String getCard() {
        return card;
    }

    public void setCard(String card) {
        this.card = card;
    }

    public boolean hasVoted() {
        return card != null;
    }
}