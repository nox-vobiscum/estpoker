package com.example.estpoker.rooms.service;

import com.example.estpoker.model.Room;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

/**
 * NoOpRoomPersistenceService
 *
 * English inline comments:
 * - Minimal, always-available fallback to satisfy DI in RoomsController.
 * - It intentionally does NOT persist anything.
 * - Scope: active in 'prod' profile (your Koyeb deploy), so local/dev
 *   won't be affected unless they also use that profile.
 *
 * Replace with a real storage-backed implementation later.
 */
@Service
@Profile("local")    // dev-only, prod uses real persistence
public class NoOpRoomPersistenceService implements RoomPersistenceService {

    private static final Logger log = LoggerFactory.getLogger(NoOpRoomPersistenceService.class);

    @Override
    public void saveFromLive(Room room, String requestedBy) {
        // No persistence; just trace.
        if (room != null) {
            log.debug("NoOp saveFromLive: roomCode={}, requestedBy={}", room.getCode(), requestedBy);
        } else {
            log.debug("NoOp saveFromLive: room is null, requestedBy={}", requestedBy);
        }
    }

    @Override
    public void setPassword(String roomCode, String newPassword) {
        // Intentionally no-op; keeps API contract without changing behavior.
        log.debug("NoOp setPassword for roomCode={} (ignored)", roomCode);
    }

    @Override
    public boolean verifyPassword(String roomCode, String password) {
        // Always 'true' to avoid blocking until real implementation exists.
        log.debug("NoOp verifyPassword for roomCode={} -> true", roomCode);
        return true;
    }
}
