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
            participantName = room.addOrReactivateParticipant(participantName);
        }

        // Remember mapping cid -> last known name for this room
        gameService.rememberClientName(roomCode, cid, participantName);

        // Cancel any pending timers for this user (disconnect/host transfer)
        gameService.cancelPendingDisconnect(room, participantName);
        gameService.cancelPendingHostTransfer(room, participantName);

        // Track the session -> room & session -> participant mappings
        gameService.addSession(session, room);
        gameService.trackParticipant(session, participantName);

        // Record a heartbeat on connect (good initial lastSeen)
        gameService.recordHeartbeat(room, participantName);

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

        // === Lightweight heartbeat (keeps proxies/load balancers happy) ===
        if (payload.startsWith("ping:")) {
            String me = gameService.getParticipantName(session);
            if (me != null) gameService.recordHeartbeat(room, me);
            return; // never broadcast
        }

        if (payload.startsWith("vote:")) {
            // FORMAT used to be "vote:<name>:<value>", but we IGNORE <name> to prevent spoofing.
            // We always use the session's participant name.
            String[] parts = payload.split(":", 3);
            String card = (parts.length >= 3) ? parts[2] : null;

            String me = gameService.getParticipantName(session);
            if (me != null && card != null) {
                Participant p = room.getParticipant(me);
                if (p != null) {
                    boolean allowedCard =
                        room.getCurrentCards().contains(card) ||
                        CardSequences.SPECIALS.contains(card);

                    // Hard guards: only participating users, only allowed cards, and not after reveal
                    if (p.isParticipating() && allowedCard && !room.areVotesRevealed()) {
                        p.setCard(card);
                        // Might flip to revealed if auto-reveal is ON and everyone voted
                        gameService.maybeAutoReveal(room);
                    }
                }
            }
            gameService.broadcastRoomState(room);

        } else if ("revealCards".equals(payload)) {
            // Only the host may reveal
            String me = gameService.getParticipantName(session);
            if (me != null) {
                Participant p = room.getParticipant(me);
                if (p != null && p.isHost()) {
                    room.setCardsRevealed(true);
                    gameService.broadcastRoomState(room);
                }
            }

        } else if ("resetRoom".equals(payload)) {
            // Only the host may reset
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
            // Anyone can toggle their own participation flag
            String me = gameService.getParticipantName(session);
            if (me != null) {
                Participant p = room.getParticipant(me);
                if (p != null) {
                    boolean on = Boolean.parseBoolean(payload.substring("setParticipating:".length()));
                    p.setParticipating(on);
                    if (!on) {
                        // Observer should not carry an old vote – clean up for a clear state
                        p.setVote(null);
                    }
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

        } else if (payload.startsWith("setTopic:")) {
            // Format: setTopic:<label>|<url>  (URL-encoded components; url may be empty)
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
            // NEW: Host can show/hide the topic area live
            String me = gameService.getParticipantName(session);
            if (me != null) {
                Participant p = room.getParticipant(me);
                if (p != null && p.isHost()) {
                    boolean visible = Boolean.parseBoolean(payload.substring("setTopicVisible:".length()));
                    room.setTopicVisible(visible);          // requires field + setter in Room
                    gameService.broadcastRoomState(room);   // GameService includes topicVisible in payload
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

    /** Read a single query parameter from the WS URL and URL-decode it (UTF-8). */
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

    /** URL-decode helper for message parts. */
    private String urlDecode(String s){
        if (s == null) return null;
        try {
            return URLDecoder.decode(s, StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return s;
        }
    }
}
