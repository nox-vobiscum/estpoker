package com.example.estpoker.handler;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.service.GameService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(GameWebSocketHandler.class);
    private final GameService gameService;

    public GameWebSocketHandler(GameService gameService) {
        this.gameService = gameService;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
        Map<String, String> q = parseQuery(session.getUri());
        String roomCode        = q.get("roomCode");
        String participantName = q.get("participantName");
        String cid             = q.get("cid");

        if (isBlank(roomCode) || isBlank(participantName)) {
            log.warn("WS connect rejected: missing params roomCode='{}' participantName='{}'", roomCode, participantName);
            try { session.close(new CloseStatus(4002, "Missing params")); } catch (Exception ignored) {}
            return;
        }

        Room room = gameService.getOrCreateRoom(roomCode);

        // Stable identity per client id (cid)
        String known = gameService.getClientName(roomCode, cid);
        if (cid != null && known != null) {
            participantName = known;
        }

        // DO NOT markInactive here; let addOrReactivate handle duplicates/reactivation.
        Object addRes = room.addOrReactivateParticipant(participantName);
        if (addRes instanceof Participant) {
            participantName = ((Participant) addRes).getName();
        } else if (addRes instanceof String) {
            participantName = (String) addRes;
        }

        // Make sure the participant is flagged active (clears any 'disconnected' flag)
        Participant p = room.getOrCreateParticipant(participantName);
        if (p != null) {
            try {
                p.setDisconnected(false);
                p.setParticipating(true); // sane default when (re)joining
            } catch (Exception ignored) {}
        }

        gameService.addSession(session, room);
        gameService.trackParticipant(session, participantName);
        gameService.rememberClientName(roomCode, cid, participantName);

        log.info("WS CONNECT room={} name={} cid={}", roomCode, participantName, cid);
        gameService.sendIdentity(session, participantName, cid);
        gameService.broadcastRoomState(room);
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) {
        String payload = message.getPayload();
        Room room = gameService.getRoomForSession(session);
        if (room == null || payload == null) return;

        try {
            if ("ping".equals(payload)) {
                // keepalive from client; optionally respond
                // session.sendMessage(new TextMessage("{\"type\":\"pong\"}"));
                return;
            }

            if (payload.startsWith("vote:")) {
                String[] parts = payload.split(":", 3);
                if (parts.length == 3) {
                    String who = parts[1];
                    String value = parts[2];
                    Participant p = room.getParticipant(who);
                    if (p == null) p = room.getOrCreateParticipant(who);
                    if (p != null) {
                        p.setVote(value);
                        gameService.broadcastRoomState(room);
                        gameService.maybeAutoReveal(room);
                    }
                }
                return;
            }

            if ("revealCards".equals(payload)) {
                gameService.revealCards(room.getCode());
                gameService.broadcastRoomState(room);
                return;
            }

            if ("resetRoom".equals(payload)) {
                room.reset();
                gameService.broadcastRoomState(room);
                return;
            }

            if (payload.startsWith("setParticipating:")) {
                boolean participating = Boolean.parseBoolean(payload.substring("setParticipating:".length()));
                String who = gameService.getParticipantName(session);
                if (who != null) {
                    Participant p2 = room.getParticipant(who);
                    if (p2 != null) {
                        p2.setParticipating(participating);
                        if (!participating) p2.setVote(null);
                        gameService.broadcastRoomState(room);
                    }
                }
                return;
            }

            if (payload.startsWith("setSequence:")) {
                String seq = payload.substring("setSequence:".length());
                room.setSequence(seq);
                gameService.broadcastRoomState(room);
                return;
            }

            if (payload.startsWith("setAutoReveal:")) {
                boolean enabled = Boolean.parseBoolean(payload.substring("setAutoReveal:".length()));
                room.setAutoRevealEnabled(enabled);
                gameService.broadcastRoomState(room);
                return;
            }

            if (payload.startsWith("transferHost:")) {
                String target = payload.substring("transferHost:".length());
                Participant prevHost = room.getHost();
                String prev = (prevHost != null ? prevHost.getName() : null);
                if (room.transferHostTo(target)) {
                    gameService.broadcastHostChange(room, prev, target);
                    gameService.broadcastRoomState(room);
                }
                return;
            }

            if (payload.startsWith("kick:")) {
                String target = payload.substring("kick:".length());
                gameService.kickParticipant(room, target);
                return;
            }

            if ("closeRoom".equals(payload)) {
                gameService.closeRoom(room);
                return;
            }

            if (payload.startsWith("setTopic:")) {
                String enc = payload.substring("setTopic:".length());
                String[] parts = enc.split("\\|", 2);
                String label = parts.length > 0 ? urlDecode(parts[0]) : null;
                String url = parts.length > 1 ? urlDecode(parts[1]) : null;
                room.setTopic(label, url);
                gameService.broadcastRoomState(room);
                return;
            }

            if ("clearTopic".equals(payload)) {
                room.setTopic(null, null);
                gameService.broadcastRoomState(room);
                return;
            }

            if ("intentLeave".equals(payload)) {
                String who = gameService.getParticipantName(session);
                if (who != null) {
                    try { room.markInactive(who); } catch (Exception ignore) {}
                    gameService.handleIntentionalLeave(room.getCode(), who);
                }
                try { session.close(new CloseStatus(4003, "Intentional leave")); } catch (Exception ignored) {}
                return;
            }

            log.debug("WS message (ignored): {}", payload);
        } catch (Exception e) {
            log.warn("WS message handling failed: {}", payload, e);
        }
    }

    @Override
    public void handleTransportError(@NonNull WebSocketSession session, @NonNull Throwable exception) {
        log.warn("WS transport error: {}", exception.toString());
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        Room room = gameService.getRoomForSession(session);
        String name = gameService.getParticipantName(session);

        gameService.removeSession(session);

        if (room != null && name != null) {
            try { room.markInactive(name); } catch (Exception ignore) {}
            log.info("WS CLOSE room={} name={} code={}", room.getCode(), name, status.getCode());
            gameService.scheduleDisconnect(room, name);
            gameService.broadcastRoomState(room);
        }
    }

    // helpers
    private static Map<String, String> parseQuery(URI uri) {
        Map<String, String> map = new HashMap<>();
        if (uri == null) return map;
        String q = uri.getQuery();
        if (q == null || q.isEmpty()) return map;
        for (String kv : q.split("&")) {
            int i = kv.indexOf('=');
            if (i > 0) {
                String k = urlDecode(kv.substring(0, i));
                String v = urlDecode(kv.substring(i + 1));
                map.put(k, v);
            } else {
                map.put(urlDecode(kv), "");
            }
        }
        return map;
    }
    private static String urlDecode(String s) {
        if (s == null) return null;
        try { return URLDecoder.decode(s, StandardCharsets.UTF_8); }
        catch (Exception ignore) { return s; }
    }
    private static boolean isBlank(String s) { return s == null || s.trim().isEmpty(); }
}
