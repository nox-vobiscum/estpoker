package com.example.estpoker.config;

import com.example.estpoker.persistence.JpaPersistentRooms;
import com.example.estpoker.persistence.NoOpPersistentRooms;
import com.example.estpoker.persistence.PersistentRooms;
import com.example.estpoker.repository.PersistentRoomRepository;
import com.example.estpoker.rooms.service.RoomPersistenceService;
import com.example.estpoker.rooms.service.RoomSnapshotter;
import com.example.estpoker.model.Room;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/**
 * Central wiring for persistence-related ports and fallbacks.
 */
@Configuration
public class PersistenceConfig {

  // --- PersistentRooms selection via feature flag ---------------------------

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

  // --- Fallback bean for RoomPersistenceService ----------------------------

  /**
   * Minimal non-persistent fallback to keep the application bootable
   * when no concrete RoomPersistenceService is provided elsewhere.
   */
  @Bean
  @ConditionalOnMissingBean(RoomPersistenceService.class)
  public RoomPersistenceService roomPersistenceServiceFallback() {
    return new NoOpRoomPersistenceService();
  }

  /**
   * Temporary, non-persistent implementation.
   * - saveFromLive(...) is a no-op (logs only)
   * - setPassword(...) is a no-op
   * - verifyPassword(...) always returns true
   */
  static final class NoOpRoomPersistenceService implements RoomPersistenceService {
    private static final Logger log = LoggerFactory.getLogger(NoOpRoomPersistenceService.class);

    @Override
    public void saveFromLive(Room room, String requestedBy) {
      if (room != null) {
        log.debug("NoOp saveFromLive: roomCode={}, requestedBy={}", room.getCode(), requestedBy);
      } else {
        log.debug("NoOp saveFromLive: room is null, requestedBy={}", requestedBy);
      }
    }

    @Override
    public void setPassword(String roomCode, String newPassword) {
      log.debug("NoOp setPassword for roomCode={} (ignored)", roomCode);
    }

    @Override
    public boolean verifyPassword(String roomCode, String password) {
      log.debug("NoOp verifyPassword for roomCode={} -> true", roomCode);
      return true;
    }
  }


  /** Debounced snapshotter; enabled by default, can be turned off via feature flag. */
  @Bean
  @ConditionalOnProperty(
      name = "features.persistentRooms.snapshot.enabled",
      havingValue = "true",
      matchIfMissing = true
  )
  public RoomSnapshotter roomSnapshotter(
      RoomPersistenceService persistence,
      @Value("${features.persistentRooms.snapshot.debounceMs:1500}") long debounceMs
  ) {
    return new RoomSnapshotter(persistence, debounceMs);
  }
  
}
