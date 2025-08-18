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

        // Ensure flags are correct on (re)join (defensive, independent of Room impl)
        Participant p = room.getParticipant(participantName);
        if (p != null) {
            p.setActive(true);
            p.setDisconnected(false);
        }

        System.out.println("✅ Host nach Join: " + (room.getHost() != null ? room.getHost().getName() : "–"));

        // Map session -> room and session -> participant
        gameService.addSession(session, room);
        gameService.trackParticipant(session, participantName);

        // Broadcast fresh state to everyone, then to the new session (ordering OK)
        gameService.broadcastRoomState(room);
        gameService.sendRoomStateToSingleSession(room, session);

        System.out.println("🧠 Teilnehmer '" + participantName + "' hat Raum '" + roomCode + "' betreten.");
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) {
        String payload = message.getPayload();
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
            gameService.broadcastRoomState(room);
        } else if ("resetRoom".equals(payload)) {
            room.reset();
            gameService.broadcastRoomState(room);
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
                // Mark fully disconnected (both flags) so UI shows sleeping row consistently
                participant.setActive(false);
                participant.setDisconnected(true);
            }

            String newHostName = room.assignNewHostIfNecessary(participantName);
            if (newHostName != null) {
                gameService.broadcastHostChange(room, participantName, newHostName);
            }

            gameService.broadcastRoomState(room);
        }

        System.out.println("📴 Verbindung geschlossen: " + session.getId() + ", Teilnehmer: " + participantName);
    }

    private String getQueryParam(@NonNull WebSocketSession session, String key) {
        URI uri = session.getUri();
        if (uri == null || uri.getQuery() == null) return null;

        for (String param : uri.getQuery().split("&")) {
            String[] kv = param.split("=");
            if (kv.length == 2 && kv[0].equals(key)) {
                return kv[1];
            }
        }
        return null;
    }
}
