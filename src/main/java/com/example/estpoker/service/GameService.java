package com.example.estpoker.service;

import com.example.estpoker.model.Room;
import com.example.estpoker.model.Participant;

import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class GameService {
    private Map<String, Room> rooms = new HashMap<>();

    public Room createRoom(String code) {
        Room room = new Room(code);
        rooms.put(code, room);
        return room;
    }

    public Room getRoom(String code) {
        return rooms.get(code);
    }

    public void joinRoom(String roomCode, String participantName) {
        Room room = rooms.get(roomCode);
        if (room != null) {
            room.addParticipant(participantName);
        }
    }

    public void submitCard(String roomCode, String participantName, String card) {
        Room room = rooms.get(roomCode);
        if (room != null) {
            Participant participant = room.getParticipant(participantName);
            if (participant != null) {
                participant.setCard(card);
            }
        }
    }

    public void revealCards(String roomCode) {
        Room room = rooms.get(roomCode);
        if (room != null) {
            room.setRevealed(true);
        }
    }

    public OptionalDouble getAverageEstimate(String roomCode) {
        Room room = rooms.get(roomCode);
        if (room == null) return OptionalDouble.empty();

        return room.getParticipants().stream()
                .map(Participant::getCard)
                .filter(c -> c.matches("\\d+")) // nur numerische Karten
                .mapToInt(Integer::parseInt)
                .average();
    }
}