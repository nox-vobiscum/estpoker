package com.example.estpoker.rooms.service;

import com.example.estpoker.model.Room;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;

import java.util.Objects;
import java.util.concurrent.*;

/**
 * Debounces frequent live changes and persists at most once per debounce window.
 */
public class RoomSnapshotter implements DisposableBean {
  private static final Logger log = LoggerFactory.getLogger(RoomSnapshotter.class);

  private final RoomPersistenceService persistence;
  private final ScheduledExecutorService scheduler;
  private final ConcurrentHashMap<String, ScheduledFuture<?>> pending = new ConcurrentHashMap<>();
  private final long debounceMs;

  public RoomSnapshotter(RoomPersistenceService persistence, long debounceMs) {
    this.persistence = Objects.requireNonNull(persistence, "persistence");
    this.debounceMs = Math.max(0, debounceMs);
    this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
      Thread t = new Thread(r, "room-snapshotter");
      t.setDaemon(true);
      return t;
    });
  }

  /** Call once after any live mutation (topic change, vote, join/leave, settings, ...). */
  public void onChange(Room room, String actor) {
    if (room == null) return;
    final String key = room.getCode();

    // schedule a (potentially replacing) save
    ScheduledFuture<?> next = scheduler.schedule(() -> {
      try {
        persistence.saveFromLive(room, actor);
      } catch (RuntimeException ex) {
        log.warn("saveFromLive failed for {}: {}", key, ex.getMessage());
      } finally {
        pending.remove(key);
      }
    }, debounceMs, TimeUnit.MILLISECONDS);

    ScheduledFuture<?> prev = pending.put(key, next);
    if (prev != null) prev.cancel(false);
  }

  /** Ensure executor is shut down when Spring disposes the bean. */
  @Override public void destroy() {
    scheduler.shutdownNow();
  }
}
