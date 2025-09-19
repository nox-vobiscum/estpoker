package com.example.estpoker.web;

import com.example.estpoker.rooms.service.RoomPersistenceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.NoSuchElementException;

/**
 * Password checks for rooms (no setting here; setting is in RoomsController).
 * Path layout kept consistent with /api/rooms.
 */
@RestController
@RequestMapping("/api/rooms")
public class RoomSecurityController {

  private final RoomPersistenceService service;

  public RoomSecurityController(RoomPersistenceService service) {
    this.service = service;
  }

  /** POST /api/rooms/{code}/password/check  body: { "password": "..." } */
  @PostMapping("/{code}/password/check")
  public ResponseEntity<?> check(@PathVariable String code, @RequestBody PasswordRequest req) {
    try {
      boolean ok = service.verifyPassword(code, req == null ? null : req.password);
      return ResponseEntity.ok(new CheckResult(ok));
    } catch (NoSuchElementException e) {
      // room does not exist → 404
      return ResponseEntity.notFound().build();
    } catch (Exception e) {
      // compact 500 payload
      return ResponseEntity.status(500).body(new ErrorView(e.getMessage()));
    }
  }

  // --- DTOs ---------------------------------------------------------------

  public static final class PasswordRequest {
    public String password;
  }

  public static final class CheckResult {
    public boolean ok;
    public CheckResult(boolean ok) { this.ok = ok; }
  }

  public static final class ErrorView {
    public boolean ok = false;
    public String message;
    public ErrorView(String message) { this.message = (message == null ? "Internal error" : message); }
  }
}
