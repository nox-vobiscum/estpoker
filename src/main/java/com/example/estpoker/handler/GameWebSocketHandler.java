package com.example.estpoker.handler;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.service.GameService;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private final GameService gameService;

    public GameWebSocketHandler(GameService gameService) {
        this.gameService = gameService;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) {
        String roomCode = getQueryParam(session, "roomCode");
        String participantName = getQueryParam(session, "participantName");

        Room room = gameService.getOrCreateRoom(roomCode);
        room.addOrReactivateParticipant(participantName);

        gameService.addSession(session, room);
        gameService.trackParticipant(session, participantName);

        gameService.broadcastRoomState(room);

        System.out.println("Neue WebSocket-Verbindung: " + session.getId());
        System.out.println("Session wurde Raum '" + roomCode + "' zugeordnet.");
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) {
        String payload = message.getPayload();
        System.out.println("Nachricht vom Client: " + payload);

        Room room = gameService.getRoomForSession(session);
        if (room == null) return;

        if (payload.startsWith("vote:")) {
            String[] parts = payload.split(":");
            if (parts.length == 3) {
                String participantName = parts[1];
                String card = parts[2];

                Participant participant = room.getParticipant(participantName);
                if (participant != null) {
                    participant.setCard(card);
                    gameService.broadcastRoomState(room);
                }
            }
        } else if ("revealCards".equals(payload)) {
            room.setCardsRevealed(true);
            gameService.broadcastReveal(room);
            System.out.println("Karten wurden aufgedeckt für Raum: " + room.getCode());
        } else if ("resetRoom".equals(payload)) {
            room.reset();
            gameService.broadcastRoomState(room);
            System.out.println("Raum '" + room.getCode() + "' wurde zurückgesetzt.");
        }
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        Room room = gameService.getRoomForSession(session);
        String participantName = gameService.getParticipantName(session);

        gameService.removeSession(session);

        if (room != null && participantName != null) {
            Participant participant = room.getParticipant(participantName);
            if (participant != null) {
                participant.setActive(false);
            }
            gameService.broadcastRoomState(room);
        }

        System.out.println("Verbindung geschlossen: " + session.getId() + ", Status: " + status);
    }

    private String getQueryParam(@NonNull WebSocketSession session, String key) {
        URI uri = session.getUri();
        if (uri == null || uri.getQuery() == null) return null;

        String query = uri.getQuery();
        for (String param : query.split("&")) {
            String[] kv = param.split("=");
            if (kv.length == 2 && kv[0].equals(key)) {
                return kv[1];
            }
        }
        return null;
    }
}
