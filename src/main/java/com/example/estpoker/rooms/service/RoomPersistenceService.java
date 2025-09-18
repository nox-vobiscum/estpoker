package com.example.estpoker.rooms.service;

import com.example.estpoker.model.Room;
import com.example.estpoker.rooms.model.StoredRoom;
import com.example.estpoker.rooms.storage.RoomRepository;
import com.example.estpoker.security.PasswordHasher;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class RoomPersistenceService {

  private final RoomRepository repo;
  private final PasswordHasher hasher;

  public RoomPersistenceService(RoomRepository repo, PasswordHasher hasher) {
    this.repo = repo;
    this.hasher = hasher;
  }

  /** Create or update a StoredRoom snapshot from an in-memory Room. */
  public StoredRoom upsertFromRoom(Room src, String title, String owner) {
    String code = src.getCode();
    StoredRoom dst = repo.load(code).orElseGet(() -> StoredRoom.newWithCode(code));

    // identity/meta
    if (title != null) dst.setTitle(title);
    if (owner != null) dst.setOwner(owner);

    // settings (nur das, was Room heute schon hat)
    var s = dst.getSettings();
    s.setSequenceId(src.getSequenceId());
    s.setAutoRevealEnabled(src.isAutoRevealEnabled());
    s.setAllowSpecials(src.isAllowSpecials());
    s.setTopicVisible(src.isTopicVisible());

    // timestamps
    dst.touchUpdated();

    repo.save(dst);
    return dst;
  }

  public Optional<StoredRoom> load(String code) {
    return repo.load(code);
  }

  public boolean exists(String code) {
    return repo.exists(code);
  }

  public void delete(String code) {
    repo.delete(code);
  }

  /** Set or clear the room password (null/blank clears). */
  public void setPassword(String code, String rawPassword) {
    StoredRoom r = repo.load(code).orElseGet(() -> StoredRoom.newWithCode(code));
    r.setPasswordFromRaw(rawPassword, hasher);
    r.touchUpdated();
    repo.save(r);
  }

  /** Validate a raw password against the stored hash; open rooms accept blank. */
  public boolean verifyPassword(String code, String rawPassword) {
    return repo.load(code).map(r -> r.verifyPassword(rawPassword, hasher)).orElse(false);
  }
}
