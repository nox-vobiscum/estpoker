package com.example.estpoker.rooms.service;

import com.example.estpoker.model.Room;

/**
 * Persistence facade for saving/loading room snapshots and optional room protection.
 * Implementations may back this with any storage (DB, file, etc.).
 * Default methods are no-ops to avoid breaking existing implementations.
 */
public interface RoomPersistenceService {

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
}
