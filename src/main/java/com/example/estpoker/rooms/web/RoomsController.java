package com.example.estpoker.rooms.web;

import com.example.estpoker.rooms.model.StoredRoom;
import com.example.estpoker.rooms.service.RoomPersistenceService;
import com.example.estpoker.rooms.storage.RoomRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

@RestController
@RequestMapping("/api/rooms")
public class RoomsController {

  private final RoomRepository repo;
  private final RoomPersistenceService service;

  public RoomsController(RoomRepository repo, RoomPersistenceService service) {
    this.repo = repo;
    this.service = service;
  }

  // --- 5.2: Exists / Get ---------------------------------------------------

  @GetMapping("/{code}/exists")
  public ResponseEntity<ExistsView> exists(@PathVariable String code) {
    return ResponseEntity.ok(new ExistsView(repo.exists(code)));
  }

  @GetMapping("/{code}")
  public ResponseEntity<StoredRoomView> get(@PathVariable String code) {
    Optional<StoredRoom> r = repo.load(code);
    return r.<ResponseEntity<StoredRoomView>>map(stored -> ResponseEntity.ok(StoredRoomView.from(stored)))
            .orElseGet(() -> ResponseEntity.notFound().build());
  }

  // --- 5.3: Upsert (nur Meta+Settings; KEIN Passwort in-/output) ----------

  @PutMapping("/{code}")
  public ResponseEntity<StoredRoomView> upsert(
      @PathVariable String code,
      @RequestBody UpsertRequest body
  ) {
    // Lade oder erzeuge
    StoredRoom r = repo.load(code).orElseGet(() -> StoredRoom.newWithCode(code));

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
    repo.save(r);
    return ResponseEntity.ok(StoredRoomView.from(r));
  }

  // --- 5.4: Passwort setzen/löschen ---------------------------------------

  @PostMapping("/{code}/set-password")
  public ResponseEntity<Void> setPassword(
      @PathVariable String code,
      @RequestBody PasswordRequest req
  ) {
    // null oder "" -> Passwort entfernen
    service.setPassword(code, (req == null ? null : req.password));
    return ResponseEntity.noContent().build();
  }

  // --- 5.5: Löschen --------------------------------------------------------

  @DeleteMapping("/{code}")
  public ResponseEntity<Void> delete(@PathVariable String code) {
    if (!repo.exists(code)) return ResponseEntity.notFound().build();
    repo.delete(code);
    return ResponseEntity.noContent().build();
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
}
