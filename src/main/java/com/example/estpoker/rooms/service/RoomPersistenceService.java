package com.example.estpoker.rooms.service;

import com.example.estpoker.model.Room;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/**
 * Persistence facade for saving/loading room snapshots and optional room protection.
 * Implementations may back this with any storage (DB, file, etc.).
 * Default methods are no-ops to avoid breaking existing implementations.
 */
public interface RoomPersistenceService {

    // ------------------------------------------------------------------------
    // Existing contract (unchanged behavior)
    // ------------------------------------------------------------------------

    /**
     * Save a snapshot of the live in-memory room to persistent storage.
     * Implementations decide what and how to store.
     */
    void saveFromLive(Room room, String requestedBy);

    /**
     * Set or clear the password for a room.
     * English inline comment: default is a no-op so existing implementations keep working.
     * Implementations should treat null/blank as "clear password".
     */
    default void setPassword(String roomCode, String newPassword) {
        // no-op by default
    }

    /**
     * Verify a provided password for a room.
     * English inline comment: default returns true to stay non-blocking at compile time.
     * Implementations should perform a constant-time comparison against the stored hash.
     */
    default boolean verifyPassword(String roomCode, String password) {
        return true;
    }

    // ------------------------------------------------------------------------
    // NEW: Contract-Lock for room metadata persistence (compile-safe defaults)
    // ------------------------------------------------------------------------

    /**
     * Fetch persisted metadata for a room.
     * English inline comment: default returns empty so legacy impls remain valid.
     */
    default Optional<RoomMeta> getMeta(String roomCode) {
        return Optional.empty();
    }

    /**
     * Upsert (insert or update) persisted metadata for a room.
     * English inline comment: default echoes back the input for compile compatibility.
     * Implementations MUST upsert by roomCode in an idempotent fashion.
     */
    default RoomMeta upsertMeta(RoomMeta meta) {
        return meta;
    }

    // ------------------------------------------------------------------------
    // DTO kept inside this file to honor "one file per answer"
    // ------------------------------------------------------------------------

    /**
     * RoomMeta
     *
     * API-safe metadata snapshot for persistence and controller mapping.
     * No raw password is included; instead, {@code passwordProtected} signals whether
     * a password is configured for the room.
     *
     * Fields reflect current RoomsController views (UpsertRequest/SettingsView):
     *  - title, owner (room-level info)
     *  - sequenceId, autoRevealEnabled, allowSpecials, topicVisible (settings)
     *  - passwordProtected (derived, not set via upsert)
     *
     * Notes:
     *  - {@code roomCode} must be non-empty.
     *  - {@code createdAt}/{@code updatedAt} are optional timestamps (storage-defined).
     */
    final class RoomMeta {
        private String roomCode;
        private String title;
        private String owner;

        private String  sequenceId;
        private Boolean autoRevealEnabled;
        private Boolean allowSpecials;
        private Boolean topicVisible;

        private boolean passwordProtected;

        private Instant createdAt;
        private Instant updatedAt;

        public RoomMeta() {
            // for frameworks
        }

        public RoomMeta(
                String roomCode,
                String title,
                String owner,
                String sequenceId,
                Boolean autoRevealEnabled,
                Boolean allowSpecials,
                Boolean topicVisible,
                boolean passwordProtected,
                Instant createdAt,
                Instant updatedAt
        ) {
            this.roomCode = requireNonEmpty(roomCode, "roomCode");
            this.title = title;
            this.owner = owner;
            this.sequenceId = sequenceId;
            this.autoRevealEnabled = autoRevealEnabled;
            this.allowSpecials = allowSpecials;
            this.topicVisible = topicVisible;
            this.passwordProtected = passwordProtected;
            this.createdAt = createdAt;
            this.updatedAt = updatedAt;
        }

        // --- getters/setters ---

        public String getRoomCode() { return roomCode; }
        public void setRoomCode(String roomCode) { this.roomCode = requireNonEmpty(roomCode, "roomCode"); }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getOwner() { return owner; }
        public void setOwner(String owner) { this.owner = owner; }

        public String getSequenceId() { return sequenceId; }
        public void setSequenceId(String sequenceId) { this.sequenceId = sequenceId; }

        public Boolean getAutoRevealEnabled() { return autoRevealEnabled; }
        public void setAutoRevealEnabled(Boolean autoRevealEnabled) { this.autoRevealEnabled = autoRevealEnabled; }

        public Boolean getAllowSpecials() { return allowSpecials; }
        public void setAllowSpecials(Boolean allowSpecials) { this.allowSpecials = allowSpecials; }

        public Boolean getTopicVisible() { return topicVisible; }
        public void setTopicVisible(Boolean topicVisible) { this.topicVisible = topicVisible; }

        public boolean isPasswordProtected() { return passwordProtected; }
        public void setPasswordProtected(boolean passwordProtected) { this.passwordProtected = passwordProtected; }

        public Instant getCreatedAt() { return createdAt; }
        public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

        public Instant getUpdatedAt() { return updatedAt; }
        public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

        // --- helpers ---

        private static String requireNonEmpty(String v, String name) {
            if (v == null || v.isBlank()) {
                throw new IllegalArgumentException(name + " must not be null/empty");
            }
            return v;
        }

        @Override
        public String toString() {
            return "RoomMeta{" +
                    "roomCode='" + roomCode + '\'' +
                    ", title='" + title + '\'' +
                    ", owner='" + owner + '\'' +
                    ", sequenceId='" + sequenceId + '\'' +
                    ", autoRevealEnabled=" + autoRevealEnabled +
                    ", allowSpecials=" + allowSpecials +
                    ", topicVisible=" + topicVisible +
                    ", passwordProtected=" + passwordProtected +
                    ", createdAt=" + createdAt +
                    ", updatedAt=" + updatedAt +
                    '}';
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof RoomMeta)) return false;
            RoomMeta that = (RoomMeta) o;
            return Objects.equals(roomCode, that.roomCode);
        }

        @Override
        public int hashCode() {
            return Objects.hash(roomCode);
        }
    }
}
