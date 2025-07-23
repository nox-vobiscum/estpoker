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
        Room room = rooms.get(code);
        if (room == null) return;

        Participant participant = room.getOrCreateParticipant(name);
        participant.setVote(card);
    }

    public void revealCards(String code) {
        Room room = rooms.get(code);
        if (room != null) {
            room.setVotesRevealed(true);
        }
    }

    public OptionalDouble getAverageEstimate(String code) {
        Room room = rooms.get(code);
        if (room == null) return OptionalDouble.empty();

        return room.getParticipants().stream()
                .map(Participant::getVote)
                .filter(v -> v.matches("\\d+")) // nur numerische Karten
                .mapToInt(Integer::parseInt)
                .average();
    }

    public Room getRoom(String code) {
        return rooms.get(code);
    }

    public Room getOrCreateRoom(String code) {
        return rooms.computeIfAbsent(code, Room::new);
    }

    public OptionalDouble calculateAverageVote(Room room) {
        return room.getParticipants().stream()
                .map(Participant::getVote)
                .filter(v -> v.matches("\\d+"))
                .mapToInt(Integer::parseInt)
                .average();
    }
}
