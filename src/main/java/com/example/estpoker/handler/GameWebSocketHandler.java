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
        String cid = getQueryParam(session, "cid"); // stabile Client-ID

        Room room = gameService.getOrCreateRoom(roomCode);

        // Falls gleicher Client (cid) im selben Room mit anderem Namen zurückkommt → rename
        String existingName = gameService.getClientName(roomCode, cid);
        if (cid != null && existingName != null && !existingName.equals(participantName)) {
            String finalName = room.renameParticipant(existingName, participantName);
            if (finalName != null) {
                participantName = finalName; // weiter mit tatsächlich verwendeten Namen
            }
        }

        // letzten Namen des Clients merken
        gameService.rememberClientName(roomCode, cid, participantName);

        // Add/reactivate & Grace-Handling
        room.addOrReactivateParticipant(participantName);
        gameService.cancelPendingDisconnect(room, participantName);

        gameService.addSession(session, room);
        gameService.trackParticipant(session, participantName);

        gameService.broadcastRoomState(room);
        gameService.sendRoomStateToSingleSession(room, session);
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

        } else if (payload.startsWith("setSequence:")) {
            String seqId = payload.substring("setSequence:".length());
            String me = gameService.getParticipantName(session);
            if (me != null) {
                var meP = room.getParticipant(me);
                if (meP != null && meP.isHost()) {
                    room.setSequence(seqId);      // setzt + reset intern
                    gameService.broadcastRoomState(room);
                }
            }

        } else if ("closeRoom".equals(payload)) {
            // nur Host darf schließen
            String me = gameService.getParticipantName(session);
            if (me != null) {
                Participant p = room.getParticipant(me);
                if (p != null && p.isHost()) {
                    gameService.closeRoom(room); // broadcast roomClosed + Sessions schließen + aufräumen
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        Room room = gameService.getRoomForSession(session);
        String participantName = gameService.getParticipantName(session);

        gameService.removeSession(session);

        if (room != null && participantName != null) {
            gameService.scheduleDisconnect(room, participantName);
        }
    }

    private String getQueryParam(@NonNull WebSocketSession session, String key) {
        URI uri = session.getUri();
        if (uri == null || uri.getQuery() == null) return null;

        for (String param : uri.getQuery().split("&")) {
            String[] kv = param.split("=", 2);
            if (kv.length == 2 && kv[0].equals(key)) {
                return kv[1]; // (optional: URL-Decoding)
            }
        }
        return null;
    }
}
