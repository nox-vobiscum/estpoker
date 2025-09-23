package com.example.estpoker.rooms.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * StoredRoom is the persisted snapshot of a room's metadata and lightweight state.
 * It is storage-agnostic and serialized/deserialized by RoomCodec implementations.
 */
public class StoredRoom {

    // --- Identity & basic metadata -----------------------------------------

    private String code;
    private String title;
    private String owner;

    private Instant createdAt;
    private Instant updatedAt;

    // Topic metadata (label + optional URL)
    private String topicLabel;
    private String topicUrl;

    // Participants snapshot (lightweight; not the live WebSocket participants)
    private List<StoredParticipant> participants = new ArrayList<>();

    private Settings settings = new Settings();
    private Stats stats; // optional; may be null until first aggregation
    private final List<HistoryItem> history = new ArrayList<>();

    /**
     * Optional BCrypt (or other) password hash.
     * If null/blank, the room is considered unprotected.
     */
    private String passwordHash;

    // --- Factory ------------------------------------------------------------

    public static StoredRoom newWithCode(String code) {
        StoredRoom r = new StoredRoom();
        r.code = Objects.requireNonNull(code, "code");
        Instant now = Instant.now();
        r.createdAt = now;
        r.updatedAt = now;
        return r;
    }

    // --- Getters / Setters --------------------------------------------------

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = Objects.requireNonNull(code, "code");
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        // allow null to clear title
        this.title = title;
        touchUpdated();
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        // allow null to clear owner
        this.owner = owner;
        touchUpdated();
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Settings getSettings() {
        if (settings == null) settings = new Settings();
        return settings;
    }

    public void setSettings(Settings settings) {
        this.settings = (settings == null ? new Settings() : settings);
        touchUpdated();
    }

    public Stats getStats() {
        return stats;
    }

    public void setStats(Stats stats) {
        this.stats = stats;
        touchUpdated();
    }

    public List<HistoryItem> getHistory() {
        return history;
    }

    /**
     * Update the "last modified" timestamp to now.
     */
    public void touchUpdated() {
    java.time.Instant now = java.time.Instant.now();

    if (this.updatedAt == null) {
        this.updatedAt = now;
        return;
    }

    if (now.isAfter(this.updatedAt)) {
        this.updatedAt = now;
    } else {
        this.updatedAt = this.updatedAt.plusNanos(1_000_000);
    }

    if (this.createdAt != null && this.updatedAt.isBefore(this.createdAt)) {
    this.updatedAt = this.createdAt.plusNanos(1_000_000);
}
}

    /**
     * Initialize createdAt if it is currently null. Does not change updatedAt.
     */
    public void touchCreatedIfNull() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
    }

    // --- Topic metadata -----------------------------------------------------

    public String getTopicLabel() {
        return topicLabel;
    }

    public void setTopicLabel(String topicLabel) {
        this.topicLabel = topicLabel;
        touchUpdated();
    }

    public String getTopicUrl() {
        return topicUrl;
    }

    public void setTopicUrl(String topicUrl) {
        this.topicUrl = topicUrl;
        touchUpdated();
    }

    // --- Participants snapshot ----------------------------------------------

    public List<StoredParticipant> getParticipants() {
        return participants;
    }

    public void setParticipants(List<StoredParticipant> participants) {
        this.participants = (participants == null ? new ArrayList<>() : participants);
        touchUpdated();
    }

    // --- Password hash (persistent) ----------------------------------------

    /**
     * Returns the stored password hash or null if no password is set.
     */
    public String getPasswordHash() {
        return passwordHash;
    }

    /**
     * Sets the stored password hash (already encoded). Use null/blank to clear.
     */
    public void setPasswordHash(String passwordHash) {
        this.passwordHash = (passwordHash == null || passwordHash.isBlank()) ? null : passwordHash;
        touchUpdated();
    }

    /**
     * True if a non-blank password hash is present.
     */
    public boolean hasPassword() {
        return passwordHash != null && !passwordHash.isBlank();
    }

    // --- Nested types -------------------------------------------------------

    /**
     * Settings contain room-level configuration flags that affect gameplay UX.
     */
    public static class Settings {
        private String sequenceId;          // e.g. "tshirt", "fib", etc.
        private boolean autoRevealEnabled;  // reveal results automatically
        private boolean allowSpecials;      // allow ❓ 💬 ☕ etc
        private boolean topicVisible;       // whether topic is visible to participants

        public String getSequenceId() {
            return sequenceId;
        }

        public void setSequenceId(String sequenceId) {
            this.sequenceId = sequenceId;
        }

        public boolean isAutoRevealEnabled() {
            return autoRevealEnabled;
        }

        public void setAutoRevealEnabled(boolean autoRevealEnabled) {
            this.autoRevealEnabled = autoRevealEnabled;
        }

        public boolean isAllowSpecials() {
            return allowSpecials;
        }

        public void setAllowSpecials(boolean allowSpecials) {
            this.allowSpecials = allowSpecials;
        }

        public boolean isTopicVisible() {
            return topicVisible;
        }

        public void setTopicVisible(boolean topicVisible) {
            this.topicVisible = topicVisible;
        }
    }

    /**
     * Stats is optional aggregated information that can be displayed after reveals.
     */
    public static class Stats {
        private int roundsPlayed;
        private double lastAverage;

        public int getRoundsPlayed() {
            return roundsPlayed;
        }

        public void setRoundsPlayed(int roundsPlayed) {
            this.roundsPlayed = roundsPlayed;
        }

        public double getLastAverage() {
            return lastAverage;
        }

        public void setLastAverage(double lastAverage) {
            this.lastAverage = lastAverage;
        }
    }

    /**
     * HistoryItem models a simple audit trail entry for this room.
     */
    public static class HistoryItem {
        private Instant at;
        private String actor;
        private String action;

        public Instant getAt() {
            return at;
        }

        public void setAt(Instant at) {
            this.at = at;
        }

        public String getActor() {
            return actor;
        }

        public void setActor(String actor) {
            this.actor = actor;
        }

        public String getAction() {
            return action;
        }

        public void setAction(String action) {
            this.action = action;
        }
    }
}
