package com.example.estpoker.service;

import com.example.estpoker.model.Room;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.TextMessage;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Optional;
import java.util.OptionalDouble;

@Service
public class GameService {

    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final Map<WebSocketSession, Room> sessionToRoomMap = new ConcurrentHashMap<>(); // Mapping von WebSocketSession zu Raum

    // Holen oder Erstellen eines Raums
    public Room getOrCreateRoom(String roomCode) {
        return rooms.computeIfAbsent(roomCode, Room::new);
    }

    // Holen eines Raums anhand des Raums-Codes
    public Room getRoom(String roomCode) {
        return rooms.get(roomCode);
    }

    // Methode, um den Raum anhand der WebSocket-Session zu erhalten
    public Room getRoomFromSession(WebSocketSession session) {
        return sessionToRoomMap.get(session);  // Gibt den Raum zurück, der mit der Session verknüpft ist
    }

    // Speichern der Kartenwahl eines Teilnehmers
    public void storeCardValue(String participantName, String cardValue) {
        // Implementierung zum Speichern der Kartenwahl
    }

    // Aufdecken der Karten
    public void revealCards(String roomCode) {
        Room room = getRoom(roomCode);
        if (room != null) {
            room.revealVotes();  // Karten aufdecken
        }
    }

    // Broadcast einer Nachricht an alle Sessions
    public void broadcastToAllSessions(String message) {
        sessionToRoomMap.keySet().forEach(session -> {
            try {
                session.sendMessage(new TextMessage(message));
            } catch (IOException e) {
                e.printStackTrace();
            }
        });
    }

    // Berechnen des Durchschnitts der Karten
    public Optional<Double> calculateAverageVote(Room room) {
        OptionalDouble avg = room.getParticipants().stream()
                .filter(p -> p.getVote() != null)  // Nur Teilnehmer mit einer Auswahl
                .mapToInt(p -> Integer.parseInt(p.getVote()))  // Umwandlung in Integer für die Berechnung
                .average();  // Gibt OptionalDouble zurück

        // OptionalDouble nach Optional<Double> umwandeln, wenn ein Wert vorhanden ist
        if (avg.isPresent()) {
            return Optional.of(avg.getAsDouble());
        } else {
            return Optional.empty();
        }
    }

    public void resetVotes(String roomCode) {
    Room room = getRoom(roomCode);
    if (room != null) {
        room.resetVotes();  // Setzt die Stimmen aller Teilnehmer zurück
    }
}
}
