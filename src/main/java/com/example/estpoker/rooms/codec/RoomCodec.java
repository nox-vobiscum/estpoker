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
    StoredRoom s = new StoredRoom();
    s.setCode(room.getCode());

    // Settings übernehmen
    StoredRoom.Settings settings = s.getSettings();
    settings.setSequenceId(room.getSequenceId());
    settings.setAutoRevealEnabled(room.isAutoRevealEnabled());
    settings.setAllowSpecials(room.isAllowSpecials());
    settings.setTopicVisible(room.isTopicVisible());

    // Aktuelles Topic (Text/URL) mit persistieren
    s.setTopicLabel(room.getTopicLabel());
    s.setTopicUrl(room.getTopicUrl());

    // Teilnehmerliste
    List<StoredParticipant> list = new ArrayList<>();
    for (Participant p : room.getParticipants()) {
      StoredParticipant sp = new StoredParticipant();
      sp.setName(p.getName());
      sp.setHost(p.isHost());
      sp.setParticipating(p.isParticipating());
      sp.setActive(p.isActive());
      sp.setVote(p.getVote());
      list.add(sp);
    }
    s.setParticipants(list);

    // Metadaten-Zeitstempel pflegen (optional)
    s.touchUpdated();

    return s;
  }

  /** Stored snapshot -> neue Live-Instanz */
  public static Room toLive(StoredRoom s) {
    Room r = new Room(s.getCode());

    // Settings anwenden (nur wenn vorhanden/nicht blank)
    StoredRoom.Settings settings = s.getSettings();
    if (settings != null) {
      String seq = settings.getSequenceId();
      if (seq != null && !seq.isBlank()) r.setSequenceId(seq);
      r.setAutoRevealEnabled(settings.isAutoRevealEnabled());
      r.setAllowSpecials(settings.isAllowSpecials());
      r.setTopicVisible(settings.isTopicVisible());
    }

    // Topic-Inhalt
    r.setTopicLabel(s.getTopicLabel());
    r.setTopicUrl(s.getTopicUrl());

    // Teilnehmer wiederherstellen
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

    // cardsRevealed absichtlich NICHT aus Persistenz setzen (flüchtig)
    return r;
  }
}
