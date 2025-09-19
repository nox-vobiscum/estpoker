package com.example.estpoker.rooms.service;

import com.example.estpoker.model.Room;
import com.example.estpoker.rooms.codec.RoomCodec;
import com.example.estpoker.rooms.model.StoredRoom;
import com.example.estpoker.rooms.repo.RoomStore;
import com.example.estpoker.security.PasswordHasher;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@ConditionalOnProperty(name = "app.storage.mode", havingValue = "ftps")
public class RoomPersistenceService {

  private final RoomStore store;
  private final PasswordHasher hasher;

  public RoomPersistenceService(RoomStore store, PasswordHasher hasher) {
    this.store = store;
    this.hasher = hasher;
  }

  /** Lädt die persistierte Snapshot-DTO (wirkt noch nicht auf Live-Room). */
  public Optional<StoredRoom> loadStored(String code) throws Exception {
    return store.load(code);
  }

  /** Persistiert einen Live-Room als Snapshot (Owner optional für Meta). */
  public void saveFromLive(Room live, String ownerDisplayName) throws Exception {
    StoredRoom dto = RoomCodec.toStored(live);
    if (ownerDisplayName != null && !ownerDisplayName.isBlank()) {
      dto.setOwner(ownerDisplayName);
    }
    // Aktualisiert created/updated und schreibt JSON
    store.save(dto);
  }

  /** Wendet einen gespeicherten Snapshot auf einen Live-Room an. */
  public void applyStoredToLive(String code, Room live) throws Exception {
    StoredRoom dto = store.load(code)
        .orElseThrow(() -> new IllegalStateException("room '" + code + "' not found"));
    RoomCodec.applyToRoom(dto, live);
  }

  /** Setzt/updated ein Passwort (raw, null/blank = löschen). */
  public void setPassword(String code, String raw) throws Exception {
    StoredRoom dto = store.load(code).orElseGet(() -> StoredRoom.newWithCode(code));
    dto.setPasswordFromRaw(raw, hasher);
    store.save(dto);
  }

  /** Verifiziert ein Passwort gegen dem gespeicherten Hash. */
  public boolean verifyPassword(String code, String raw) throws Exception {
    Optional<StoredRoom> dto = store.load(code);
    // Wenn es noch keinen Snapshot gibt, betrachten wir das wie "kein Passwort gesetzt"
    return dto.map(r -> r.verifyPassword(raw, hasher))
              .orElse(false);
  }
}
