package com.example.estpoker.rooms.service;

import com.example.estpoker.model.Room;
import com.example.estpoker.security.PasswordHasher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * InMemoryRoomPersistenceService
 *
 * - Profile-scoped in-memory implementation of RoomPersistenceService.
 * - Stores room metadata and a password hash in a ConcurrentHashMap.
 * - Intended as a safe step before wiring a real storage backend.
 *
 * Behavior:
 * - getMeta / upsertMeta: CRUD-like operations on metadata by roomCode.
 * - setPassword / verifyPassword: uses PasswordHasher; if no password is set, verify returns true.
 * - saveFromLive: only touches timestamps; makes no assumptions about Room fields other than code.
 */
@Service
@Primary               // Prefer this over other RoomPersistenceService beans (e.g., NoOp)
@Profile("prod-h2")    // Limit to current deploy profile
public class InMemoryRoomPersistenceService implements RoomPersistenceService {

    private static final Logger log = LoggerFactory.getLogger(InMemoryRoomPersistenceService.class);

    private final PasswordHasher hasher;

    // Mapping: roomCode -> Entry(meta + passwordHash)
    private final ConcurrentHashMap<String, Entry> store = new ConcurrentHashMap<>();

    public InMemoryRoomPersistenceService(PasswordHasher hasher) {
        this.hasher = Objects.requireNonNull(hasher, "hasher");
    }

    // ---------------------------------------------------------------------
    // Snapshot from live (non-intrusive)
    // ---------------------------------------------------------------------

    @Override
    public void saveFromLive(Room room, String requestedBy) {
        // Only touch timestamps; do not assume any Room getters beyond getCode().
        if (room == null) {
            log.debug("saveFromLive ignored: room is null (requestedBy={})", requestedBy);
            return;
        }
        final String roomCode;
        try {
            roomCode = Objects.requireNonNull(room.getCode(), "room.getCode()");
        } catch (Throwable t) {
            log.debug("saveFromLive ignored: cannot resolve room code (requestedBy={})", requestedBy);
            return;
        }
        if (roomCode.isBlank()) {
            log.debug("saveFromLive ignored: room code is blank (requestedBy={})", requestedBy);
            return;
        }

        store.compute(roomCode, (k, existing) -> {
            Instant now = Instant.now();
            if (existing == null) {
                var meta = new RoomPersistenceService.RoomMeta();
                meta.setRoomCode(roomCode);
                meta.setCreatedAt(now);
                meta.setUpdatedAt(now);
                // Other fields remain null until controller upserts them.
                return new Entry(meta, null);
            } else {
                var m = copy(existing.meta);
                m.setUpdatedAt(now);
                return new Entry(m, existing.passwordHash);
            }
        });
        log.debug("saveFromLive touched meta for roomCode={}, requestedBy={}", roomCode, requestedBy);
    }

    // ---------------------------------------------------------------------
    // Metadata
    // ---------------------------------------------------------------------

    @Override
    public Optional<RoomPersistenceService.RoomMeta> getMeta(String roomCode) {
        if (roomCode == null || roomCode.isBlank()) return Optional.empty();
        Entry e = store.get(roomCode);
        if (e == null) return Optional.empty();
        var m = copy(e.meta);
        m.setPasswordProtected(e.passwordHash != null && !e.passwordHash.isBlank());
        return Optional.of(m);
    }

    @Override
    public RoomPersistenceService.RoomMeta upsertMeta(RoomPersistenceService.RoomMeta meta) {
        Objects.requireNonNull(meta, "meta");
        String code = requireNonEmpty(meta.getRoomCode(), "roomCode");
        Instant now = Instant.now();

        Entry updated = store.compute(code, (k, existing) -> {
            var next = new RoomPersistenceService.RoomMeta();
            next.setRoomCode(code);

            // Copy fields from input; null means "keep current" if an entry exists.
            if (existing == null) {
                next.setCreatedAt(now);
                next.setTitle(meta.getTitle());
                next.setOwner(meta.getOwner());
                next.setSequenceId(meta.getSequenceId());
                next.setAutoRevealEnabled(meta.getAutoRevealEnabled());
                next.setAllowSpecials(meta.getAllowSpecials());
                next.setTopicVisible(meta.getTopicVisible());
            } else {
                var cur = existing.meta;
                next.setCreatedAt(cur.getCreatedAt() == null ? now : cur.getCreatedAt());
                next.setTitle( pick(meta.getTitle(),            cur.getTitle()) );
                next.setOwner( pick(meta.getOwner(),            cur.getOwner()) );
                next.setSequenceId( pick(meta.getSequenceId(),  cur.getSequenceId()) );
                next.setAutoRevealEnabled( pick(meta.getAutoRevealEnabled(), cur.getAutoRevealEnabled()) );
                next.setAllowSpecials( pick(meta.getAllowSpecials(), cur.getAllowSpecials()) );
                next.setTopicVisible( pick(meta.getTopicVisible(), cur.getTopicVisible()) );
            }
            next.setUpdatedAt(now);

            String hash = (existing == null ? null : existing.passwordHash);
            next.setPasswordProtected(hash != null && !hash.isBlank());
            return new Entry(next, hash);
        });

        return copy(updated.meta);
    }

    // ---------------------------------------------------------------------
    // Passwords
    // ---------------------------------------------------------------------

    @Override
    public void setPassword(String roomCode, String newPassword) {
        String code = requireNonEmpty(roomCode, "roomCode");
        store.compute(code, (k, existing) -> {
            Instant now = Instant.now();
            if (newPassword == null || newPassword.isBlank()) {
                // Clear password
                if (existing == null) {
                    var meta = new RoomPersistenceService.RoomMeta();
                    meta.setRoomCode(code);
                    meta.setCreatedAt(now);
                    meta.setUpdatedAt(now);
                    meta.setPasswordProtected(false);
                    return new Entry(meta, null);
                } else {
                    var m = copy(existing.meta);
                    m.setUpdatedAt(now);
                    m.setPasswordProtected(false);
                    return new Entry(m, null);
                }
            } else {
                String hash = hasher.hash(newPassword);
                if (existing == null) {
                    var meta = new RoomPersistenceService.RoomMeta();
                    meta.setRoomCode(code);
                    meta.setCreatedAt(now);
                    meta.setUpdatedAt(now);
                    meta.setPasswordProtected(true);
                    return new Entry(meta, hash);
                } else {
                    var m = copy(existing.meta);
                    m.setUpdatedAt(now);
                    m.setPasswordProtected(true);
                    return new Entry(m, hash);
                }
            }
        });
        log.debug("setPassword updated protection for roomCode={}", code);
    }

    @Override
    public boolean verifyPassword(String roomCode, String password) {
        if (roomCode == null || roomCode.isBlank()) return true; // Stay permissive like the default
        Entry e = store.get(roomCode);
        if (e == null || e.passwordHash == null || e.passwordHash.isBlank()) {
            // No password set -> allow
            return true;
        }
        return hasher.matches(password, e.passwordHash);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private static String requireNonEmpty(String v, String name) {
        if (v == null || v.isBlank()) throw new IllegalArgumentException(name + " must not be null/empty");
        return v;
    }

    private static <T> T pick(T incoming, T current) {
        // Null means "no change"
        return (incoming != null ? incoming : current);
    }

    private static RoomPersistenceService.RoomMeta copy(RoomPersistenceService.RoomMeta src) {
        if (src == null) return null;
        var d = new RoomPersistenceService.RoomMeta();
        d.setRoomCode(src.getRoomCode());
        d.setTitle(src.getTitle());
        d.setOwner(src.getOwner());
        d.setSequenceId(src.getSequenceId());
        d.setAutoRevealEnabled(src.getAutoRevealEnabled());
        d.setAllowSpecials(src.getAllowSpecials());
        d.setTopicVisible(src.getTopicVisible());
        d.setPasswordProtected(src.isPasswordProtected());
        d.setCreatedAt(src.getCreatedAt());
        d.setUpdatedAt(src.getUpdatedAt());
        return d;
    }

    private record Entry(RoomPersistenceService.RoomMeta meta, String passwordHash) { }
}
