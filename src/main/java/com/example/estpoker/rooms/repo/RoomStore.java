package com.example.estpoker.rooms.repo;

import com.example.estpoker.rooms.model.StoredRoom;

public interface RoomStore {
  void save(StoredRoom room) throws Exception;
  StoredRoom load(String code) throws Exception;
}
