package com.example.estpoker.rooms.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * JSON-persisted room snapshot for FTPS storage.
 * Keep this DTO stable and additive; avoid breaking changes to field names.
 *
 * Security note:
 * - passwordHash contains a BCrypt hash (optionally peppered via PasswordHasher).
 * - Do NOT expose this DTO 1:1 in public REST responses.
 */
public class StoredRoom {

  // --- identity / metadata ---
  private String code;            // room code (required, filename stem)
  private String title;           // optional display title
  private String owner;           // creator/current owner by display name

  private String passwordHash;    // BCrypt hash (never raw)

  private Instant createdAt;      // set on first persist
  private Instant updatedAt;      // update on each write

  // --- current room settings (only the toggles needed by your UI) ---
  private Settings settings = new Settings();

  // --- aggregate statistics over time (optional / best-effort) ---
  private Stats stats = new Stats();

  // --- compact history of finished rounds (optional) ---
  private List<HistoryItem> history = new ArrayList<>();

  // ----- lifecycle helpers --------------------------------------------------

  /** Ensure timestamps exist; call when creating a brand-new room. */
  public void touchCreatedIfNull() {
    if (createdAt == null) createdAt = Instant.now();
    touchUpdated();
  }

  /** Update the "updatedAt" timestamp; call before saving the JSON. */
  public void touchUpdated() {
    updatedAt = Instant.now();
  }

  /**
   * Set a new password by hashing the raw input with your PasswordHasher.
   * Passing null/blank will clear the password (room becomes open).
   */
  public void setPasswordFromRaw(String raw, com.example.estpoker.security.PasswordHasher hasher) {
    Objects.requireNonNull(hasher, "hasher");
    if (raw == null || raw.isBlank()) {
      this.passwordHash = null;
    } else {
      this.passwordHash = hasher.hash(raw);
    }
  }

  /**
   * Verify a raw password against the stored hash.
   * If no hash is set, empty/blank passwords are considered valid.
   */
  public boolean verifyPassword(String raw, com.example.estpoker.security.PasswordHasher hasher) {
    Objects.requireNonNull(hasher, "hasher");
    if (passwordHash == null || passwordHash.isBlank()) {
      return raw == null || raw.isBlank();
    }
    return hasher.matches(raw, passwordHash);
  }

  /** Remove the password protection (hash cleared). */
  public void clearPassword() {
    this.passwordHash = null;
  }

  /** Convenience: create a new instance with code + timestamps initialized. */
  public static StoredRoom newWithCode(String code) {
    StoredRoom r = new StoredRoom();
    r.code = Objects.requireNonNull(code, "code");
    r.touchCreatedIfNull();
    return r;
  }

  // ----- nested types -------------------------------------------------------

  /** User-facing toggles that define the current behavior of the room. */
  public static class Settings {
    private String sequenceId = "fib.scrum"; // deck/sequence id
    private boolean autoRevealEnabled = false;
    private boolean allowSpecials = true;
    private boolean topicVisible = false;

    // getters/setters
    public String getSequenceId() { return sequenceId; }
    public void setSequenceId(String sequenceId) { this.sequenceId = sequenceId; }
    public boolean isAutoRevealEnabled() { return autoRevealEnabled; }
    public void setAutoRevealEnabled(boolean autoRevealEnabled) { this.autoRevealEnabled = autoRevealEnabled; }
    public boolean isAllowSpecials() { return allowSpecials; }
    public void setAllowSpecials(boolean allowSpecials) { this.allowSpecials = allowSpecials; }
    public boolean isTopicVisible() { return topicVisible; }
    public void setTopicVisible(boolean topicVisible) { this.topicVisible = topicVisible; }
  }

  /** Cheap running totals; refine later when the repository is in place. */
  public static class Stats {
    private long sessions;              // number of sessions played
    private long totalVotes;            // total votes recorded
    private double averageOfAverages;   // rolling average (optional, best-effort)
    private long totalSessionSeconds;   // accumulated session duration

    // getters/setters
    public long getSessions() { return sessions; }
    public void setSessions(long sessions) { this.sessions = sessions; }
    public long getTotalVotes() { return totalVotes; }
    public void setTotalVotes(long totalVotes) { this.totalVotes = totalVotes; }
    public double getAverageOfAverages() { return averageOfAverages; }
    public void setAverageOfAverages(double averageOfAverages) { this.averageOfAverages = averageOfAverages; }
    public long getTotalSessionSeconds() { return totalSessionSeconds; }
    public void setTotalSessionSeconds(long totalSessionSeconds) { this.totalSessionSeconds = totalSessionSeconds; }
  }

  /** Minimal per-round history entry; can be extended later. */
  public static class HistoryItem {
    private Instant at;           // time the round finished
    private String topicLabel;    // the visible topic text (if any)
    private String topicUrl;      // optional link
    private String resultAverage; // formatted average string (e.g., "5.3")
    private List<String> votes;   // optional raw votes (can be omitted for privacy)

    // getters/setters
    public Instant getAt() { return at; }
    public void setAt(Instant at) { this.at = at; }
    public String getTopicLabel() { return topicLabel; }
    public void setTopicLabel(String topicLabel) { this.topicLabel = topicLabel; }
    public String getTopicUrl() { return topicUrl; }
    public void setTopicUrl(String topicUrl) { this.topicUrl = topicUrl; }
    public String getResultAverage() { return resultAverage; }
    public void setResultAverage(String resultAverage) { this.resultAverage = resultAverage; }
    public List<String> getVotes() { return votes; }
    public void setVotes(List<String> votes) { this.votes = votes; }
  }

  // ----- getters/setters (flat) --------------------------------------------

  public String getCode() { return code; }
  public void setCode(String code) { this.code = code; }

  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }

  public String getOwner() { return owner; }
  public void setOwner(String owner) { this.owner = owner; }

  public String getPasswordHash() { return passwordHash; }
  public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

  public Settings getSettings() { return settings; }
  public void setSettings(Settings settings) { this.settings = settings; }

  public Stats getStats() { return stats; }
  public void setStats(Stats stats) { this.stats = stats; }

  public List<HistoryItem> getHistory() { return history; }
  public void setHistory(List<HistoryItem> history) { this.history = history; }
}
