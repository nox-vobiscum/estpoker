package com.example.estpoker.rooms.codec;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.rooms.model.StoredParticipant;
import com.example.estpoker.rooms.model.StoredRoom;

import java.util.ArrayList;
import java.util.List;

public final class RoomCodec {
  private RoomCodec() {}

  /** Live -> Stored snapshot */
  public static StoredRoom toStored(Room room) {
    if (room == null) return null;

    StoredRoom s = new StoredRoom();
    s.setCode(room.getCode());

    // Settings
    StoredRoom.Settings settings = s.getSettings();
    settings.setSequenceId(room.getSequenceId());
    settings.setAutoRevealEnabled(room.isAutoRevealEnabled());
    settings.setAllowSpecials(room.isAllowSpecials());
    settings.setTopicVisible(room.isTopicVisible());

    // Topic
    s.setTopicLabel(room.getTopicLabel());
    s.setTopicUrl(room.getTopicUrl());

    // Participants
    List<StoredParticipant> list = new ArrayList<>();
    if (room.getParticipants() != null) {
      for (Participant p : room.getParticipants()) {
        StoredParticipant sp = new StoredParticipant();
        sp.setName(p.getName());
        sp.setHost(p.isHost());
        sp.setParticipating(p.isParticipating());
        sp.setActive(p.isActive());
        sp.setVote(p.getVote());
        list.add(sp);
      }
    }
    s.setParticipants(list);

    // Metadata
    s.touchUpdated();
    return s;
  }

  /** Apply stored snapshot fields into an existing live instance */
  public static void applyToRoom(StoredRoom s, Room live) {
    if (s == null || live == null) return;

    var st = s.getSettings();
    if (st != null) {
      if (st.getSequenceId() != null && !st.getSequenceId().isBlank()) {
        live.setSequenceId(st.getSequenceId());
      }
      live.setAutoRevealEnabled(st.isAutoRevealEnabled());
      live.setAllowSpecials(st.isAllowSpecials());
      live.setTopicVisible(st.isTopicVisible());
    }

    if (s.getTopicLabel() != null) live.setTopicLabel(s.getTopicLabel());
    if (s.getTopicUrl() != null)   live.setTopicUrl(s.getTopicUrl());
  }

  /** Stored snapshot -> new live instance */
  public static Room toLive(StoredRoom s) {
    if (s == null) return null;

    Room r = new Room(s.getCode());

    // Settings
    StoredRoom.Settings settings = s.getSettings();
    if (settings != null) {
      String seq = settings.getSequenceId();
      if (seq != null && !seq.isBlank()) r.setSequenceId(seq);
      r.setAutoRevealEnabled(settings.isAutoRevealEnabled());
      r.setAllowSpecials(settings.isAllowSpecials());
      r.setTopicVisible(settings.isTopicVisible());
    }

    // Topic
    r.setTopicLabel(s.getTopicLabel());
    r.setTopicUrl(s.getTopicUrl());

    // Participants
    if (s.getParticipants() != null) {
      for (StoredParticipant sp : s.getParticipants()) {
        Participant p = new Participant(sp.getName());
        p.setHost(sp.isHost());
        p.setParticipating(sp.isParticipating());
        p.setActive(sp.isActive());
        p.setVote(sp.getVote());
        r.addParticipant(p);
      }
    }

    return r;
  }
}
