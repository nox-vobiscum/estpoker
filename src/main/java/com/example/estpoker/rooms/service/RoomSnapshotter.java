package com.example.estpoker.rooms.service;

import com.example.estpoker.model.Room;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Debounces rapid live mutations and persists snapshots via RoomPersistenceService.
 */
public class RoomSnapshotter {

    private static final Logger log = LoggerFactory.getLogger(RoomSnapshotter.class);

    private final RoomPersistenceService service;
    private final long debounceMs;

    private final ScheduledExecutorService scheduler;
    private final ConcurrentMap<String, ScheduledFuture<?>> inflight = new ConcurrentHashMap<>();

    public RoomSnapshotter(RoomPersistenceService service, long debounceMs) {
        this.service = service;
        this.debounceMs = Math.max(0, debounceMs);
        this.scheduler = Executors.newSingleThreadScheduledExecutor(new ThreadFactory() {
            private final AtomicInteger c = new AtomicInteger();
            @Override public Thread newThread(Runnable r) {
                Thread t = new Thread(r, "room-snapshotter-" + c.incrementAndGet());
                t.setDaemon(true);
                return t;
            }
        });
        log.info("RoomSnapshotter initialized (debounceMs={})", this.debounceMs);
    }

    /**
     * Signal that a live room has changed. After the debounce window, the latest state is persisted.
     */
    public void onChange(Room room, String actor) {
        if (room == null) return;
        String code = room.getCode();
        if (code == null || code.isBlank()) return;

        Runnable task = () -> {
            try {
                service.saveFromLive(room, actor);
                log.debug("Snapshot persisted (room={}, actor={})", code, actor);
            } catch (Throwable t) {
                log.warn("Snapshot failed (room={}, actor={}): {}", code, actor, t.toString());
            } finally {
                inflight.remove(code);
            }
        };

        ScheduledFuture<?> prev = inflight.get(code);
        if (prev != null && !prev.isDone()) {
            prev.cancel(false);
        }
        ScheduledFuture<?> fut = scheduler.schedule(task, debounceMs, TimeUnit.MILLISECONDS);
        inflight.put(code, fut);
    }

    @PreDestroy
    public void shutdown() {
        try {
            scheduler.shutdownNow();
        } catch (Exception ignored) {
        }
    }
}
