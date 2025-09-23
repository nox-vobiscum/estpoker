package com.example.estpoker.rooms.service;

import com.example.estpoker.model.Room;
import com.example.estpoker.rooms.codec.RoomCodec;
import com.example.estpoker.rooms.model.StoredRoom;
import com.example.estpoker.rooms.repo.RoomStore;
import com.example.estpoker.security.PasswordHasher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Optional;

@Service
public class StoredRoomPersistenceService implements RoomPersistenceService {

  private static final Logger log = LoggerFactory.getLogger(StoredRoomPersistenceService.class);

  private final RoomStore store;
  private final PasswordHasher hasher;

  public StoredRoomPersistenceService(RoomStore store, PasswordHasher hasher) {
    this.store = store;
    this.hasher = hasher;
  }

  @Override
  public void saveFromLive(Room room, String requestedBy) {
    if (room == null) return;

    try {
      // Build a snapshot from the live model
      StoredRoom snap = RoomCodec.toStored(room);

      // EXTRA SAFETY: ensure we keep the live code as-is (case-preserving)
      if (snap.getCode() == null || !snap.getCode().equals(room.getCode())) {
        snap.setCode(room.getCode());
      }

      // Try to load existing persistent state
      StoredRoom existing = store.load(room.getCode()).orElse(null);

      if (existing == null) {
        // First write: accept snapshot as-is, keep timestamps sane
        snap.touchCreatedIfNull();
        snap.touchUpdated();
        if (log.isDebugEnabled()) {
          log.debug("saveFromLive: creating new snapshot for roomCode={} by={}", snap.getCode(), requestedBy);
        }
        store.save(snap);
        return;
      }

      // --- Merge into existing WITHOUT touching password/auth fields ---
      final String keepPasswordHash = existing.getPasswordHash(); // preserve!

      // Settings
      StoredRoom.Settings ss = snap.getSettings();
      if (ss != null) {
        StoredRoom.Settings es = existing.getSettings();
        if (es == null) {
          es = new StoredRoom.Settings();
          existing.setSettings(es);
        }
        es.setSequenceId(ss.getSequenceId());
        es.setAutoRevealEnabled(ss.isAutoRevealEnabled());
        es.setAllowSpecials(ss.isAllowSpecials());
        es.setTopicVisible(ss.isTopicVisible());
      }

      // Topic
      existing.setTopicLabel(snap.getTopicLabel());
      existing.setTopicUrl(snap.getTopicUrl());

      // Participants (replace with snapshot list)
      if (snap.getParticipants() != null) {
        existing.setParticipants(new ArrayList<>(snap.getParticipants()));
      } else {
        existing.setParticipants(null);
      }

      // Make sure code stays identical to live (case-preserving)
      if (!room.getCode().equals(existing.getCode())) {
        existing.setCode(room.getCode());
      }

      // Re-apply preserved password hash (in case any setter cascades touched it)
      if (existing.getPasswordHash() != keepPasswordHash) { // ref-compare is fine for quick check
        existing.setPasswordHash(keepPasswordHash);
      }

      // Keep createdAt; bump updatedAt
      existing.touchUpdated();

      if (log.isDebugEnabled()) {
        log.debug("saveFromLive: merged snapshot for roomCode={} by={} (pwdHashKept={})",
            existing.getCode(), requestedBy, keepPasswordHash != null);
      }
      store.save(existing);

    } catch (Exception e) {
      // Best-effort: log and swallow so the app keeps running
      final String code = (room != null ? room.getCode() : "<null>");
      if (log.isDebugEnabled()) {
        log.debug("saveFromLive failed for room {}: {}", code, e.toString(), e);
      } else {
        log.warn("saveFromLive failed for room {}: {}", code, e.toString());
      }
    }
  }

  @Override
  public void setPassword(String roomCode, String newPassword) {
    if (roomCode == null || roomCode.isBlank()) return;

    try {
      StoredRoom r = store.load(roomCode).orElseGet(() -> StoredRoom.newWithCode(roomCode));
      if (newPassword == null || newPassword.isBlank()) {
        r.setPasswordHash(null); // clearing password
      } else {
        r.setPasswordHash(hasher.hash(newPassword));
      }
      r.touchCreatedIfNull();
      r.touchUpdated();
      store.save(r);
    } catch (Exception e) {
      throw new RuntimeException("setPassword failed for room " + roomCode, e);
    }
  }

  @Override
  public boolean verifyPassword(String roomCode, String password) {
    if (roomCode == null || roomCode.isBlank()) return (password == null || password.isBlank());

    try {
      Optional<StoredRoom> rOpt = store.load(roomCode);
      if (rOpt.isEmpty()) {
        // no stored record -> only allow when no password provided
        return (password == null || password.isBlank());
      }
      String hash = rOpt.get().getPasswordHash();
      return hasher.matches(password, hash);
    } catch (Exception e) {
      log.warn("verifyPassword failed for room {}: {}", roomCode, e.getMessage());
      return false;
    }
  }
}
