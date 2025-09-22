package com.example.estpoker.config;

import com.example.estpoker.persistence.JpaPersistentRooms;
import com.example.estpoker.persistence.NoOpPersistentRooms;
import com.example.estpoker.persistence.PersistentRooms;
import com.example.estpoker.repository.PersistentRoomRepository;
import com.example.estpoker.rooms.service.RoomPersistenceService;
import com.example.estpoker.model.Room;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wählt je nach Feature-Flag die passende Implementierung des Ports aus.
 * 
 * English inline comments:
 * - This config now also provides a minimal fallback for RoomPersistenceService
 *   to keep the application bootable until a real implementation is wired.
 */
@Configuration
public class PersistenceConfig {

    // --- Existing wiring for PersistentRooms (unchanged) --------------------

    @Bean
    @ConditionalOnProperty(name = "features.persistentRooms.enabled", havingValue = "true")
    public PersistentRooms persistentRoomsJpa(PersistentRoomRepository repo) {
        return new JpaPersistentRooms(repo);
    }

    @Bean
    @ConditionalOnProperty(name = "features.persistentRooms.enabled", havingValue = "false", matchIfMissing = true)
    public PersistentRooms persistentRoomsNoOp() {
        return new NoOpPersistentRooms();
    }

    // --- NEW: Fallback bean for RoomPersistenceService ----------------------

    /**
     * Provides a minimal, non-persistent RoomPersistenceService when no other
     * bean of the same type is present. Keeps DI in RoomsController satisfied.
     *
     * English inline comments:
     * - @ConditionalOnMissingBean ensures this bean is only created when there is
     *   no real implementation registered elsewhere.
     * - Intentionally no profile restriction: works for all profiles unless a
     *   proper implementation exists. Add @Profile if you prefer scoping.
     */
    @Bean
    @ConditionalOnMissingBean(RoomPersistenceService.class)
    public RoomPersistenceService roomPersistenceServiceFallback() {
        return new NoOpRoomPersistenceService();
    }

    /**
     * NoOpRoomPersistenceService
     *
     * English inline comments:
     * - Temporary, non-persistent implementation.
     * - saveFromLive(...) does nothing except optional debug logs.
     * - setPassword(...) is a no-op.
     * - verifyPassword(...) always returns true to avoid blocking.
     * Replace with a real storage-backed implementation later.
     */
    static final class NoOpRoomPersistenceService implements RoomPersistenceService {
        private static final Logger log = LoggerFactory.getLogger(NoOpRoomPersistenceService.class);

        @Override
        public void saveFromLive(Room room, String requestedBy) {
            // Intentionally no-op; log for traceability.
            if (room != null) {
                log.debug("NoOp saveFromLive: roomCode={}, requestedBy={}", room.getCode(), requestedBy);
            } else {
                log.debug("NoOp saveFromLive: room is null, requestedBy={}", requestedBy);
            }
        }

        @Override
        public void setPassword(String roomCode, String newPassword) {
            // No-op by design in fallback.
            log.debug("NoOp setPassword for roomCode={} (ignored)", roomCode);
        }

        @Override
        public boolean verifyPassword(String roomCode, String password) {
            // Always 'true' in fallback to keep app running.
            log.debug("NoOp verifyPassword for roomCode={} -> true", roomCode);
            return true;
        }
    }
}
