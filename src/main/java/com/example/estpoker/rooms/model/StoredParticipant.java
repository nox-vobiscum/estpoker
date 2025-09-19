package com.example.estpoker.rooms.model;

public class StoredParticipant {
  private String name;
  private boolean host;
  private boolean participating;
  private boolean active;
  private String vote;

  public StoredParticipant() {}

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public boolean isHost() { return host; }
  public void setHost(boolean host) { this.host = host; }
  public boolean isParticipating() { return participating; }
  public void setParticipating(boolean participating) { this.participating = participating; }
  public boolean isActive() { return active; }
  public void setActive(boolean active) { this.active = active; }
  public String getVote() { return vote; }
  public void setVote(String vote) { this.vote = vote; }
}
