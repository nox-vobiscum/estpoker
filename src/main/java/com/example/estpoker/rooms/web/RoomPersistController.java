package com.example.estpoker.rooms.web;

import com.example.estpoker.rooms.storage.RoomJsonStore;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/persist")
public class RoomPersistController {

  private final RoomJsonStore store;

  public RoomPersistController(RoomJsonStore store) {
    this.store = store;
  }

  /** Speichert JSON unter <code>.json. Body darf beliebiges JSON sein (StoredRoom oder Testobjekt). */
  @PutMapping(value = "/rooms/{code}", consumes = MediaType.APPLICATION_JSON_VALUE)
  public Map<String, Object> save(@PathVariable String code, @RequestBody Map<String, Object> body) throws Exception {
    store.save(code, body);
    return Map.of("ok", true, "saved", code + ".json");
  }

  /** Liest die gespeicherte Datei roh (String). */
  @GetMapping("/rooms/{code}")
  public Map<String, Object> load(@PathVariable String code) throws Exception {
    String json = store.readRaw(code);
    return Map.of("ok", true, "code", code, "json", json);
  }
}
