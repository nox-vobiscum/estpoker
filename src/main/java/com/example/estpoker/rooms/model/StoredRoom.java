package com.example.estpoker.rooms.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * JSON-friendly DTO for persisted rooms.
 * Keep this separate from the in-memory Room (com.example.estpoker.model.Room).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class StoredRoom {

  /** Stable, URL-safe identifier (e.g. "alpha-team"). */
  private String id;

  /** Display name shown in UI. */
  private String name;

  /** Optional list of previously seen participants (display names). */
  private List<String> pastParticipants = new ArrayList<>();

  /** Room settings snapshot. */
  private Settings settings = new Settings();

  /** Cumulative statistics. */
  private Stats stats = new Stats();

  /** Optional history entries (topic + result). */
  private List<HistoryEntry> history = new ArrayList<>();

  /** BCrypt hash of the room password (null if not protected). */
  private String passwordHash;

  /** Audit / bookkeeping. */
  private Instant createdAt = Instant.now();
  private Instant updatedAt = Instant.now();
  private int version = 1;

  // ----- getters & setters -----
  public String getId() { return id; }
  public void setId(String id) { this.id = id; }

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }

  public List<String> getPastParticipants() { return pastParticipants; }
  public void setPastParticipants(List<String> pastParticipants) { this.pastParticipants = pastParticipants; }

  public Settings getSettings() { return settings; }
  public void setSettings(Settings settings) { this.settings = settings; }

  public Stats getStats() { return stats; }
  public void setStats(Stats stats) { this.stats = stats; }

  public List<HistoryEntry> getHistory() { return history; }
  public void setHistory(List<HistoryEntry> history) { this.history = history; }

  public String getPasswordHash() { return passwordHash; }
  public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

  public int getVersion() { return version; }
  public void setVersion(int version) { this.version = version; }

  // ----- nested DTOs -----

  /** User-tunable settings that should persist across sessions. */
  public static class Settings {
    /** Card sequence in use, e.g. ["1","2","3","5","8","13","?","☕"]. */
    private List<String> cardSequence;

    /** Reveal cards automatically when everyone voted. */
    private boolean autoReveal;

    /** "hard" / "soft" behavior (free-form vs strict). */
    private String mode;

    /** Whether topic field is visible/enabled. */
    private boolean topicField;

    public List<String> getCardSequence() { return cardSequence; }
    public void setCardSequence(List<String> cardSequence) { this.cardSequence = cardSequence; }
    public boolean isAutoReveal() { return autoReveal; }
    public void setAutoReveal(boolean autoReveal) { this.autoReveal = autoReveal; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public boolean isTopicField() { return topicField; }
    public void setTopicField(boolean topicField) { this.topicField = topicField; }
  }

  /** Accumulated simple statistics. Extend freely later. */
  public static class Stats {
    private long votesTotal;
    private double votesAverage;
    private long sessionsCount;
    private long totalSessionSeconds;

    public long getVotesTotal() { return votesTotal; }
    public void setVotesTotal(long votesTotal) { this.votesTotal = votesTotal; }
    public double getVotesAverage() { return votesAverage; }
    public void setVotesAverage(double votesAverage) { this.votesAverage = votesAverage; }
    public long getSessionsCount() { return sessionsCount; }
    public void setSessionsCount(long sessionsCount) { this.sessionsCount = sessionsCount; }
    public long getTotalSessionSeconds() { return totalSessionSeconds; }
    public void setTotalSessionSeconds(long totalSessionSeconds) { this.totalSessionSeconds = totalSessionSeconds; }
  }

  /** Optional history of topics and results. */
  public static class HistoryEntry {
    private String topic;
    private String result;
    private Map<String, String> extra;

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }
    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }
    public Map<String, String> getExtra() { return extra; }
    public void setExtra(Map<String, String> extra) { this.extra = extra; }
  }
}
