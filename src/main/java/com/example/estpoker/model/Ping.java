package com.example.estpoker.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

@Entity
public class Ping {

    @Id
    private Long id;

    // Standard-Konstruktor
    public Ping() {}

    public Ping(Long id) {
        this.id = id;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }
}
