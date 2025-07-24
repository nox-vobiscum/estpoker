package com.example.estpoker.service;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GameService {

    private final Map<String, Room> rooms = new ConcurrentHashMap<>();

    public void createRoom(String code) {
        rooms.putIfAbsent(code, new Room(code));
    }

    public void joinRoom(String code, String name) {
        Room room = rooms.computeIfAbsent(code, Room::new);
        room.getOrCreateParticipant(name);
    }

    public void submitCard(String code, String name, String card) {
    System.out.println("📝 submitCard() aufgerufen");
    System.out.println("➡ Raum: " + code);
    System.out.println("➡ Teilnehmer: " + name);
    System.out.println("➡ Gewählte Karte: '" + card + "'");

    Room room = rooms.get(code);
    if (room == null) {
        System.out.println("❌ Raum nicht gefunden!");
        return;
    }

    Participant participant = room.getOrCreateParticipant(name);
    if (participant == null) {
        System.out.println("❌ Teilnehmer nicht gefunden!");
        return;
    }

    participant.setVote(card);
    System.out.println("✅ Karte gespeichert: " + participant.getVote());
}


    public void revealCards(String code) {
        Room room = rooms.get(code);
        if (room != null) {
            room.setRevealed(true);
            System.out.println("Karten wurden für Raum " + code + " aufgedeckt.");
        }
    }

    public OptionalDouble calculateAverageVote(Room room) {
    System.out.println("🔍 Starte Berechnung des Durchschnitts ...");

    return room.getParticipants().stream()
        .map(Participant::getVote)
        .filter(Objects::nonNull)
        .peek(v -> System.out.println("➡ Stimme gefunden: '" + v + "'"))
        .map(String::trim)
        .filter(v -> {
            boolean isNumeric = v.matches("\\d+");
            System.out.println("🔎 Ist '" + v + "' numerisch? → " + isNumeric);
            return isNumeric;
        })
        .mapToInt(Integer::parseInt)
        .average()
        .stream()
        .peek(avg -> System.out.println("✅ Durchschnitt berechnet: " + avg))
        .findFirst();
}




    public void resetVotes(String roomCode) {
        Room room = getRoom(roomCode);
        if (room != null) {
            for (Participant p : room.getParticipants()) {
                p.setVote(null);
            }
            room.setRevealed(false);
            System.out.println("Raum " + roomCode + " wurde zurückgesetzt.");
        }
    }

    public Room getRoom(String code) {
        return rooms.get(code);
    }

    public Room getOrCreateRoom(String code) {
        return rooms.computeIfAbsent(code, Room::new);
    }
}
