package com.example.estpoker.rooms.web;

import com.example.estpoker.rooms.model.StoredRoom;
import com.example.estpoker.rooms.repo.RoomStore;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/persist/rooms")
@ConditionalOnProperty(name = "app.storage.mode", havingValue = "ftps")
public class RoomPersistController {

  private final RoomStore store;

  public RoomPersistController(RoomStore store) {
    this.store = store;
  }

  @GetMapping("/{code}")
  public ResponseEntity<?> get(@PathVariable String code) {
    try {
      var room = store.load(code);
      return ResponseEntity.ok(room);
    } catch (Exception e) {
      return ResponseEntity.status(404).body(Map.of(
        "error", "not_found",
        "message", e.getMessage()
      ));
    }
  }

  @PutMapping("/{code}")
  public ResponseEntity<?> put(@PathVariable String code, @RequestBody StoredRoom body) {
    try {
      body.setCode(code);                 // Pfad & Body synchronisieren
      store.save(body);
      return ResponseEntity.ok(Map.of("ok", true, "code", code));
    } catch (Exception e) {
      return ResponseEntity.status(500).body(Map.of(
        "ok", false,
        "message", e.getClass().getSimpleName() + ": " + e.getMessage()
      ));
    }
  }
}
