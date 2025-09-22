package com.example.estpoker.rooms.service;

import com.example.estpoker.model.Room;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

/**
 * NoOpRoomPersistenceService
 *
 * Minimal bean to satisfy dependency injection in RoomsController for the prod-h2 profile.
 * This is a temporary, non-persistent implementation:
 *  - saveFromLive(...) does nothing
 *  - password handling uses the interface defaults (no-op / always true)
 *
 * Replace with a real persistence-backed implementation later.
 */
@Service
@Profile("prod-h2") // limit to current deploy profile; avoids affecting other environments
@ConditionalOnMissingBean(RoomPersistenceService.class) // auto-disable when a real bean exists
public class NoOpRoomPersistenceService implements RoomPersistenceService {

    private static final Logger log = LoggerFactory.getLogger(NoOpRoomPersistenceService.class);

    @Override
    public void saveFromLive(Room room, String requestedBy) {
        // English inline comment: Intentionally no-op; just logs for traceability.
        if (room != null) {
            log.debug("NoOp saveFromLive: roomCode={}, requestedBy={}", room.getCode(), requestedBy);
        } else {
            log.debug("NoOp saveFromLive: room is null, requestedBy={}", requestedBy);
        }
    }

    // NOTE: setPassword(...) and verifyPassword(...) are inherited as defaults from the interface:
    // - setPassword(...) = no-op
    // - verifyPassword(...) = returns true
    // This keeps the app running until a real persistence implementation is provided.
}
