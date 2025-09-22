package com.example.estpoker.rooms.service;

import com.example.estpoker.model.Room;
import com.example.estpoker.rooms.codec.RoomCodec;
import com.example.estpoker.rooms.model.StoredRoom;
import com.example.estpoker.rooms.repo.RoomStore;
import com.example.estpoker.security.PasswordHasher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

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
      Optional<StoredRoom> existingOpt = store.load(room.getCode());
      if (existingOpt.isEmpty()) {
        StoredRoom snap = RoomCodec.toStored(room);
        if (snap == null) return;
        snap.touchCreatedIfNull();
        store.save(snap);
        return;
      }

      StoredRoom existing = existingOpt.get();

      // Preserve fields that must be kept
      String previousHash = existing.getPasswordHash();
      var createdAt = existing.getCreatedAt();

      // Build fresh snapshot and merge into existing
      StoredRoom snap = RoomCodec.toStored(room);

      existing.setTitle(snap.getTitle());
      existing.setOwner(snap.getOwner());

      var es = existing.getSettings();
      var ss = snap.getSettings();
      es.setSequenceId(ss.getSequenceId());
      es.setAutoRevealEnabled(ss.isAutoRevealEnabled());
      es.setAllowSpecials(ss.isAllowSpecials());
      es.setTopicVisible(ss.isTopicVisible());

      existing.setTopicLabel(snap.getTopicLabel());
      existing.setTopicUrl(snap.getTopicUrl());
      existing.setParticipants(snap.getParticipants());

      // Restore preserved metadata
      existing.setPasswordHash(previousHash);
      if (createdAt != null) existing.setCreatedAt(createdAt);
      else existing.touchCreatedIfNull();

      // Ensure updatedAt moves forward (fix for failing test)
      existing.touchUpdated();

      store.save(existing);
    } catch (Exception e) {
      throw new RuntimeException("saveFromLive failed for room " + room.getCode(), e);
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
