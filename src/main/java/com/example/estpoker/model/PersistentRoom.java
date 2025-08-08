package com.example.estpoker.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.security.SecureRandom;
import java.time.Instant;

@Entity
@Table(
    name = "persistent_rooms",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_persistent_rooms_name", columnNames = "name")
    },
    indexes = {
        @Index(name = "idx_persistent_rooms_last_active_at", columnList = "lastActiveAt"),
        @Index(name = "idx_persistent_rooms_test_room", columnList = "testRoom")
    }
)
public class PersistentRoom {

    @Id
    @Column(length = 6, nullable = false, updatable = false)
    private String id;

    @NotBlank
    @Size(max = 100)
    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant lastActiveAt;

    /** Markierung für Test-Räume (z. B. für häufigeres Auto-Cleanup) */
    @Column(nullable = false)
    private boolean testRoom = false;

    protected PersistentRoom() {}

    public PersistentRoom(String name) {
        this.name = name != null ? name.trim() : null;
    }

    @PrePersist
    protected void onCreate() {
        if (this.id == null || this.id.isBlank()) {
            this.id = generateId(6);
        }
        Instant now = Instant.now();
        if (this.createdAt == null) this.createdAt = now;
        if (this.lastActiveAt == null) this.lastActiveAt = now;
        if (this.name != null) this.name = this.name.trim();
    }

    public void touch() {
        this.lastActiveAt = Instant.now();
    }

    private static final char[] ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    public static String generateId(int length) {
        char[] out = new char[length];
        for (int i = 0; i < length; i++) out[i] = ALPHANUM[RANDOM.nextInt(ALPHANUM.length)];
        return new String(out);
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; } // nur für Tests

    public String getName() { return name; }
    public void setName(String name) { this.name = (name != null ? name.trim() : null); }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getLastActiveAt() { return lastActiveAt; }
    public void setLastActiveAt(Instant lastActiveAt) { this.lastActiveAt = lastActiveAt; }

    public boolean isTestRoom() { return testRoom; }
    public void setTestRoom(boolean testRoom) { this.testRoom = testRoom; }

    @Override
    public String toString() {
        return "PersistentRoom{" +
                "id='" + id + '\'' +
                ", name='" + name + '\'' +
                ", createdAt=" + createdAt +
                ", lastActiveAt=" + lastActiveAt +
                ", testRoom=" + testRoom +
                '}';
    }
}
