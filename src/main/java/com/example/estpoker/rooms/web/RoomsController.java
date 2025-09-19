package com.example.estpoker.rooms.web;

import com.example.estpoker.rooms.model.StoredRoom;
import com.example.estpoker.rooms.repo.RoomStore;
import com.example.estpoker.rooms.service.RoomPersistenceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

@RestController
@RequestMapping("/api/rooms")
public class RoomsController {

  private final RoomStore store;
  private final RoomPersistenceService service;

  public RoomsController(RoomStore store, RoomPersistenceService service) {
    this.store = store;
    this.service = service;
  }

  // --- Exists / Get --------------------------------------------------------

  @GetMapping("/{code}/exists")
  public ResponseEntity<?> exists(@PathVariable String code) {
    try {
      return ResponseEntity.ok(new ExistsView(store.exists(code)));
    } catch (Exception e) {
      return ResponseEntity.internalServerError().body(new ErrorView(e.getMessage()));
    }
  }

  @GetMapping("/{code}")
  public ResponseEntity<?> get(@PathVariable String code) {
    try {
      Optional<StoredRoom> r = store.load(code);
      return r.<ResponseEntity<?>>map(stored -> ResponseEntity.ok(StoredRoomView.from(stored)))
              .orElseGet(() -> ResponseEntity.notFound().build());
    } catch (Exception e) {
      return ResponseEntity.internalServerError().body(new ErrorView(e.getMessage()));
    }
  }

  // --- Upsert (nur Meta + Settings; KEIN Passwort IO) ----------------------

  @PutMapping("/{code}")
  public ResponseEntity<?> upsert(
      @PathVariable String code,
      @RequestBody UpsertRequest body
  ) {
    try {
      // Lade oder erzeuge
      StoredRoom r = store.load(code).orElseGet(() -> StoredRoom.newWithCode(code));

      // Meta
      if (body.title != null)  r.setTitle(body.title);
      if (body.owner != null)  r.setOwner(body.owner);

      // Settings (nur wenn geliefert)
      var s = r.getSettings();
      if (body.sequenceId != null)            s.setSequenceId(body.sequenceId);
      if (body.autoRevealEnabled != null)     s.setAutoRevealEnabled(body.autoRevealEnabled);
      if (body.allowSpecials != null)         s.setAllowSpecials(body.allowSpecials);
      if (body.topicVisible != null)          s.setTopicVisible(body.topicVisible);

      r.touchUpdated();
      store.save(r);
      return ResponseEntity.ok(StoredRoomView.from(r));
    } catch (Exception e) {
      return ResponseEntity.internalServerError().body(new ErrorView(e.getMessage()));
    }
  }

  // --- Passwort setzen/löschen --------------------------------------------

  @PostMapping("/{code}/set-password")
  public ResponseEntity<?> setPassword(
      @PathVariable String code,
      @RequestBody PasswordRequest req
  ) {
    try {
      service.setPassword(code, (req == null ? null : req.password));
      return ResponseEntity.noContent().build();
    } catch (Exception e) {
      return ResponseEntity.internalServerError().body(new ErrorView(e.getMessage()));
    }
  }

  // --- Löschen -------------------------------------------------------------

  @DeleteMapping("/{code}")
  public ResponseEntity<?> delete(@PathVariable String code) {
    try {
      if (!store.exists(code)) return ResponseEntity.notFound().build();
      store.delete(code);
      return ResponseEntity.noContent().build();
    } catch (Exception e) {
      return ResponseEntity.internalServerError().body(new ErrorView(e.getMessage()));
    }
  }

  // ====== DTOs (Views/Requests) ============================================

  /** GET /exists view */
  public static final class ExistsView {
    public boolean exists;
    public ExistsView(boolean exists) { this.exists = exists; }
  }

  /** Redacted view (ohne passwordHash) */
  public static final class StoredRoomView {
    public String code;
    public String title;
    public String owner;
    public Instant createdAt;
    public Instant updatedAt;
    public SettingsView settings;

    public static StoredRoomView from(StoredRoom r) {
      Objects.requireNonNull(r, "r");
      StoredRoomView v = new StoredRoomView();
      v.code = r.getCode();
      v.title = r.getTitle();
      v.owner = r.getOwner();
      v.createdAt = r.getCreatedAt();
      v.updatedAt = r.getUpdatedAt();

      var s = r.getSettings();
      SettingsView sv = new SettingsView();
      if (s != null) {
        sv.sequenceId = s.getSequenceId();
        sv.autoRevealEnabled = s.isAutoRevealEnabled();
        sv.allowSpecials = s.isAllowSpecials();
        sv.topicVisible = s.isTopicVisible();
      }
      v.settings = sv;
      return v;
    }
  }

  public static final class SettingsView {
    public String  sequenceId;
    public boolean autoRevealEnabled;
    public boolean allowSpecials;
    public boolean topicVisible;
  }

  /** PUT body */
  public static final class UpsertRequest {
    public String  title;
    public String  owner;
    public String  sequenceId;
    public Boolean autoRevealEnabled;
    public Boolean allowSpecials;
    public Boolean topicVisible;
  }

  /** POST set-password body */
  public static final class PasswordRequest {
    public String password;
  }

  public static final class ErrorView {
    public boolean ok = false;
    public String message;
    public ErrorView(String message) { this.message = (message == null ? "Internal error" : message); }
  }
}
