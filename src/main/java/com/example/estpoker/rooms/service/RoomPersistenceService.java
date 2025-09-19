package com.example.estpoker.rooms.service;

import com.example.estpoker.model.Room;
import com.example.estpoker.rooms.model.StoredRoom;
import com.example.estpoker.rooms.repo.RoomStore;
import com.example.estpoker.security.PasswordHasher;
import com.example.estpoker.rooms.codec.RoomCodec;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "app.storage.mode", havingValue = "ftps")
public class RoomPersistenceService {

  private final RoomStore store;
  private final RoomCodec codec;
  private final PasswordHasher hasher;

  public RoomPersistenceService(RoomStore store, RoomCodec codec, PasswordHasher hasher) {
    this.store = store;
    this.codec = codec;
    this.hasher = hasher;
  }

  /** Lädt die persistierte Snapshot-DTO (wirkt noch nicht auf Live-Room). */
  public StoredRoom loadStored(String code) throws Exception {
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
    StoredRoom dto = store.load(code);
    RoomCodec.applyToRoom(dto, live);
  }

  /** Setzt/updated ein Passwort (raw, null/blank = löschen). */
  public void setPassword(String code, String raw) throws Exception {
    StoredRoom dto;
    try {
      dto = store.load(code);
    } catch (Exception notFound) {
      // Neu anlegen, wenn noch nicht existiert
      dto = StoredRoom.newWithCode(code);
    }
    dto.setPasswordFromRaw(raw, hasher);
    store.save(dto);
  }

  /** Verifiziert ein Passwort gegen dem gespeicherten Hash. */
  public boolean verifyPassword(String code, String raw) throws Exception {
    StoredRoom dto = store.load(code);
    return dto.verifyPassword(raw, hasher);
  }
}
