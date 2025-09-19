package com.example.estpoker.rooms.repo;

import com.example.estpoker.rooms.model.StoredRoom;
import com.example.estpoker.service.StorageProbeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

@Repository
@ConditionalOnProperty(name = "app.storage.mode", havingValue = "ftps")
public class FtpsRoomStore implements RoomStore {

  private final StorageProbeService storage;
  private final ObjectMapper om;

  public FtpsRoomStore(StorageProbeService storage, ObjectMapper om) {
    this.storage = storage;
    this.om = om;
  }

  private String fileName(String code) {
    // baseDir ist bereits z.B. "ep-api/rooms" → hier nur "<code>.json"
    return code + ".json";
  }

  @Override
  public void save(StoredRoom room) throws Exception {
    if (room == null || room.getCode() == null || room.getCode().isBlank()) {
      throw new IllegalArgumentException("room.code required");
    }
    // timestamps: createdAt nur, wenn neu
    if (room.getCreatedAt() == null) room.touchCreatedIfNull();
    room.touchUpdated();

    String json = om.writeValueAsString(room);
    storage.writeUtf8(fileName(room.getCode()), json);
  }

  @Override
  public StoredRoom load(String code) throws Exception {
    String json = storage.readUtf8(fileName(code));
    return om.readValue(json, StoredRoom.class);
  }
}
