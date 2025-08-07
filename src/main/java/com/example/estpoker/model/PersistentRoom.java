package com.example.estpoker.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
public class PersistentRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String name;

    @Column(unique = true)
    private String roomId;

    private LocalDateTime createdAt;

    public PersistentRoom() {
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getRoomId() {
        return roomId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public void setCreatedAtNow() {
        this.createdAt = LocalDateTime.now();
    }
}
