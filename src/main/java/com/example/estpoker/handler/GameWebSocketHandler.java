package com.example.estpoker.handler;

import com.example.estpoker.model.CardSequences;
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
        String roomCode        = getQueryParam(session, "roomCode");
        String participantName = getQueryParam(session, "participantName");
        String cid             = getQueryParam(session, "cid"); // stable per TAB (sessionStorage)

        if (roomCode == null || roomCode.isBlank()
                || participantName == null || participantName.isBlank()) {
            try { session.close(new CloseStatus(4002, "Missing params")); } catch (Exception ignored) {}
            return;
        }

        Room room = gameService.getOrCreateRoom(roomCode);

        // Reuse/rename known client-id instead of duplicating
        String known = gameService.getClientName(roomCode, cid);
        if (cid != null && known != null) {
            if (!known.equals(participantName)) {
                String finalName = room.renameParticipant(known, participantName);
                participantName = (finalName != null ? finalName : known);
            } else {
                participantName = known;
            }
            room.markActive(participantName);
        } else {
            participantName = room.addOrReactivateParticipant(participantName);
        }

        // Remember client-id → name
        gameService.rememberClientName(roomCode, cid, participantName);

        // Cancel pending disconnect (tab refresh etc.)
        gameService.cancelPendingDisconnect(room, participantName);

        // Track mappings
        gameService.addSession(session, room);
        gameService.trackParticipant(session, participantName);

        // Tell this session its authoritative identity
        gameService.sendIdentity(session, participantName, cid);

        // Sync state
        gameService.broadcastRoomState(room);
        gameService.sendRoomStateToSingleSession(room, session);
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) {
        String payload = message.getPayload();
        Room room = gameService.getRoomForSession(session);
        if (room == null) return;

        // --- NEW: explicit "I'm leaving now" signal (beforeunload/pagehide) ---
        if ("leavingNow".equals(payload)) {
            String me = gameService.getParticipantName(session);
            if (me != null) {
                // Immediately mark inactive and reassign host if needed
                gameService.markLeftIntentionally(room, me);
            }
            try { session.close(new CloseStatus(4003, "Intentional leave")); } catch (Exception ignored) {}
            return;
        }

        if (payload.startsWith("vote:")) {
            String[] parts = payload.split(":", 3);
            String card = (parts.length >= 3) ? parts[2] : null;

            String me = gameService.getParticipantName(session);
            if (me != null && card != null) {
                Participant p = room.getParticipant(me);
                if (p != null) {
                    boolean allowedCard =
                        room.getCurrentCards().contains(card) ||
                        CardSequences.SPECIALS.contains(card);

                    if (p.isParticipating() && allowedCard && !room.areVotesRevealed()) {
                        p.setCard(card);
                        gameService.maybeAutoReveal(room);
                    }
                }
            }
            gameService.broadcastRoomState(room);

        } else if ("revealCards".equals(payload)) {
            String me = gameService.getParticipantName(session);
            if (me != null) {
                Participant p = room.getParticipant(me);
                if (p != null && p.isHost()) {
                    room.setCardsRevealed(true);
                    gameService.broadcastRoomState(room);
                }
            }

        } else if ("resetRoom".equals(payload)) {
            String me = gameService.getParticipantName(session);
            if (me != null) {
                Participant p = room.getParticipant(me);
                if (p != null && p.isHost()) {
                    room.reset();
                    gameService.broadcastRoomState(room);
                }
            }

        } else if (payload.startsWith("setSequence:")) {
            String seqId = payload.substring("setSequence:".length());
            String me = gameService.getParticipantName(session);
            if (me != null) {
                Participant meP = room.getParticipant(me);
                if (meP != null && meP.isHost()) {
                    room.setSequence(seqId);
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
                    if (!on) p.setVote(null);
                    gameService.maybeAutoReveal(room);
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

        } else if (payload.startsWith("setTopic:")) {
            String rest = payload.substring("setTopic:".length());
            String label = null;
            String url   = null;
            int sep = rest.indexOf('|');
            if (sep >= 0) {
                label = urlDecode(rest.substring(0, sep));
                String u = urlDecode(rest.substring(sep + 1));
                url = (u != null && !u.isBlank()) ? u : null;
            } else {
                label = urlDecode(rest);
            }
            String me = gameService.getParticipantName(session);
            if (me != null) {
                Participant p = room.getParticipant(me);
                if (p != null && p.isHost()) {
                    room.setTopic(label, url);
                    gameService.broadcastRoomState(room);
                }
            }

        } else if ("clearTopic".equals(payload)) {
            String me = gameService.getParticipantName(session);
            if (me != null) {
                Participant p = room.getParticipant(me);
                if (p != null && p.isHost()) {
                    room.setTopic(null, null);
                    gameService.broadcastRoomState(room);
                }
            }

        } else if (payload.startsWith("setTopicVisible:")) {
            String me = gameService.getParticipantName(session);
            if (me != null) {
                Participant p = room.getParticipant(me);
                if (p != null && p.isHost()) {
                    boolean visible = Boolean.parseBoolean(payload.substring("setTopicVisible:".length()));
                    room.setTopicVisible(visible);
                    gameService.broadcastRoomState(room);
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

        // Schedule grace before marking inactive (handles timeouts / brief blips)
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
                try {
                    return URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
                } catch (Exception ignored) {
                    return kv[1];
                }
            }
        }
        return null;
    }

    private String urlDecode(String s){
        if (s == null) return null;
        try {
            return URLDecoder.decode(s, StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return s;
        }
    }
}
