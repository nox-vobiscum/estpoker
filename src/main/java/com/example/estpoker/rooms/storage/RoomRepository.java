package com.example.estpoker.rooms.storage;

import com.example.estpoker.rooms.model.StoredRoom;

import java.util.Optional;

public interface RoomRepository {
  Optional<StoredRoom> load(String code);

  /** Create or replace atomically. */
  void save(StoredRoom room);

  boolean exists(String code);

  void delete(String code);
}
