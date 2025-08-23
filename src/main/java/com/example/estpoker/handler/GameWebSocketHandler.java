package com.example.estpoker.handler;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.service.GameService;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/**
 * WebSocket handler for all game-related realtime messages.
 * Keeps business state in GameService/Room and only orchestrates I/O.
 */
@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private final GameService gameService;

    public GameWebSocketHandler(GameService gameService) {
        this.gameService = gameService;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) {
        // Read and URL-decode query params (robust to spaces/umlauts)
        String roomCode        = getQueryParam(session, "roomCode");
        String participantName = getQueryParam(session, "participantName");
        String cid             = getQueryParam(session, "cid"); // stable per TAB (sessionStorage)

        // Defensive: refuse sessions with missing essentials
        if (roomCode == null || roomCode.isBlank()
                || participantName == null || participantName.isBlank()) {
            try { session.close(new CloseStatus(4002, "Missing params")); } catch (Exception ignored) {}
            return;
        }

        Room room = gameService.getOrCreateRoom(roomCode);

        // If we already know this cid in this room, reactivate/rename instead of creating a duplicate
        String known = gameService.getClientName(roomCode, cid);
        if (cid != null && known != null) {
            if (!known.equals(participantName)) {
                // Client tried to rename on reconnect; let Room resolve conflicts
                String finalName = room.renameParticipant(known, participantName);
                participantName = (finalName != null ? finalName : known);
            } else {
                participantName = known;
            }
            room.markActive(participantName); // reactivate, not a duplicate
        } else {
            // First connection with this cid in this room
            // (Method may return the final name if your Room impl does that)
            participantName = room.addOrReactivateParticipant(participantName);
        }

        // Remember mapping cid -> last known name for this room
        gameService.rememberClientName(roomCode, cid, participantName);

        // Cancel any pending "disconnect grace" for this user
        gameService.cancelPendingDisconnect(room, participantName);

        // Track the session -> room & session -> participant mappings
        gameService.addSession(session, room);
        gameService.trackParticipant(session, participantName);

        // Tell only THIS session its authoritative name (prevents cross-tab rename)
        gameService.sendIdentity(session, participantName, cid);

        // Broadcast the current room state to everyone + ensure the new session is up to date
        gameService.broadcastRoomState(room);
        gameService.sendRoomStateToSingleSession(room, session);
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) {
        String payload = message.getPayload();
        Room room = gameService.getRoomForSession(session);
        if (room == null) return;

        if (payload.startsWith("vote:")) {
            // Format: "vote:<name>:<value>" – split into at most 3 parts to keep card intact
            String[] parts = payload.split(":", 3);
            if (parts.length == 3) {
                String participantName = parts[1];
                String card = parts[2];
                Participant participant = room.getParticipant(participantName);
                if (participant != null) {
                    participant.setCard(card);
                    gameService.maybeAutoReveal(room); // respects auto-reveal
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
                Participant meP = room.getParticipant(me);
                if (meP != null && meP.isHost()) {
                    room.setSequence(seqId); // usually resets votes as well
                    gameService.broadcastRoomState(room);
                }
            }

        } else if (payload.startsWith("setAutoReveal:")) {
            String me = gameService.getParticipantName(session);
            boolean wantOn = Boolean.parseBoolean(payload.substring("setAutoReveal:".length()));
            if (me != null) {
                Participant p = room.getParticipant(me);
                if (p != null && p.isHost()) {
                    room.setAutoRevealEnabled(wantOn);
                    if (wantOn) gameService.maybeAutoReveal(room);
                    gameService.broadcastRoomState(room);
                }
            }

        } else if (payload.startsWith("setParticipating:")) {
            String me = gameService.getParticipantName(session);
            if (me != null) {
                Participant p = room.getParticipant(me);
                if (p != null) {
                    boolean on = Boolean.parseBoolean(payload.substring("setParticipating:".length()));
                    p.setParticipating(on);
                    gameService.maybeAutoReveal(room); // may flip to revealed if now complete
                    gameService.broadcastRoomState(room);
                }
            }

        } else if (payload.startsWith("transferHost:")) {
            String me = gameService.getParticipantName(session);
            String targetName = payload.substring("transferHost:".length());
            if (me != null) {
                Participant meP = room.getParticipant(me);
                if (meP != null && meP.isHost()) {
                    String oldHost = (room.getHost() != null) ? room.getHost().getName() : me;
                    boolean ok = room.transferHostTo(targetName);
                    if (ok) {
                        gameService.broadcastHostChange(room, oldHost, targetName);
                        gameService.broadcastRoomState(room);
                    }
                }
            }

        } else if (payload.startsWith("kick:")) {
            String me = gameService.getParticipantName(session);
            String targetName = payload.substring("kick:".length());
            if (me != null) {
                Participant meP = room.getParticipant(me);
                Participant target = room.getParticipant(targetName);
                if (meP != null && meP.isHost() && target != null && !target.isHost() && !me.equals(targetName)) {
                    gameService.kickParticipant(room, targetName);
                }
            }

        } else if ("closeRoom".equals(payload)) {
            String me = gameService.getParticipantName(session);
            if (me != null) {
                Participant p = room.getParticipant(me);
                if (p != null && p.isHost()) {
                    gameService.closeRoom(room);
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        Room room = gameService.getRoomForSession(session);
        String participantName = gameService.getParticipantName(session);

        // Clean up mappings for this session
        gameService.removeSession(session);

        // Schedule a short "grace" before marking inactive/broadcasting (handles page refresh)
        if (room != null && participantName != null) {
            gameService.scheduleDisconnect(room, participantName);
        }
    }

    /**
     * Read a single query parameter from the WS URL and URL-decode it (UTF-8).
     */
    private String getQueryParam(@NonNull WebSocketSession session, String key) {
        URI uri = session.getUri();
        if (uri == null || uri.getQuery() == null) return null;
        for (String param : uri.getQuery().split("&")) {
            String[] kv = param.split("=", 2);
            if (kv.length == 2 && kv[0].equals(key)) {
                try {
                    return URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
                } catch (Exception ignored) {
                    return kv[1]; // fall back to raw if decoding fails
                }
            }
        }
        return null;
    }
}
