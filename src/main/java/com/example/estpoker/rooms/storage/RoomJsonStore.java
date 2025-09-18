package com.example.estpoker.rooms.storage;

import com.example.estpoker.service.StorageProbeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class RoomJsonStore {
  private final StorageProbeService files;
  private final ObjectMapper om;

  public RoomJsonStore(StorageProbeService files, ObjectMapper om) {
    this.files = files;
    this.om = om;
  }

  /** Speichert das Object (z.B. StoredRoom) unter <code>.json im FTPS-Basisverzeichnis. */
  public void save(String code, Object payload) throws Exception {
    if (code == null || code.isBlank()) throw new IllegalArgumentException("code");
    String json = om.writeValueAsString(payload);
    files.writeUtf8(code + ".json", json);
  }

  /** Liest den JSON-String zurück (roh). */
  public String readRaw(String code) throws Exception {
    if (code == null || code.isBlank()) throw new IllegalArgumentException("code");
    return files.readUtf8(code + ".json");
  }
}
