package com.example.planningpoker.rooms.repo;

import com.example.planningpoker.rooms.model.StoredRoom;

import java.util.Optional;

public interface RoomStore {
  /** Lädt einen Raum-Snapshot; leer wenn Datei (noch) nicht existiert. */
  Optional<StoredRoom> load(String code) throws Exception;

  /** Speichert/überschreibt den Snapshot. */
  void save(StoredRoom room) throws Exception;

  /** Existiert {code}.json im Store? */
  boolean exists(String code) throws Exception;

  /** Löscht {code}.json, falls vorhanden. */
  void delete(String code) throws Exception;
}
