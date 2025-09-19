package com.example.estpoker.web;

import com.example.estpoker.rooms.service.RoomPersistenceService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/persist/rooms")
@ConditionalOnProperty(name = "app.storage.mode", havingValue = "ftps")
public class RoomSecurityController {

  private final RoomPersistenceService service;

  public RoomSecurityController(RoomPersistenceService service) {
    this.service = service;
  }

  /** Set/clear password: POST /api/persist/rooms/{code}/password  body: {"password":"..."} */
  @PostMapping("/{code}/password")
  public ResponseEntity<?> setPassword(@PathVariable String code, @RequestBody Map<String,String> body) {
    try {
      String pw = body == null ? null : body.get("password");
      service.setPassword(code, pw);
      return ResponseEntity.ok(Map.of("ok", true, "code", code, "protected", pw != null && !pw.isBlank()));
    } catch (Exception e) {
      return ResponseEntity.status(500).body(Map.of("ok", false, "message", e.getMessage()));
    }
  }

  /** Verify: GET /api/persist/rooms/{code}/verify?pw=... */
  @GetMapping("/{code}/verify")
  public ResponseEntity<?> verify(@PathVariable String code, @RequestParam(name="pw", required=false) String pw) {
    try {
      boolean ok = service.verifyPassword(code, pw);
      return ResponseEntity.ok(Map.of("ok", ok));
    } catch (Exception e) {
      return ResponseEntity.status(404).body(Map.of("ok", false, "message", e.getMessage()));
    }
  }
}
