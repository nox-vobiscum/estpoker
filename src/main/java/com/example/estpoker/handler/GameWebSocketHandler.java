package com.example.estpoker.handler;

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
import java.util.Objects;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(GameWebSocketHandler.class);

    private final GameService gameService;

    // keep a tiny per-session index (room, cid, name) to avoid recomputing
    private final Map<String, Conn> bySession = new HashMap<>();

    // Host inactivity threshold (ms) after which we reassign
    private static final long HOST_INACTIVE_MS = 120_000L;

    public GameWebSocketHandler(GameService gameService) {
        this.gameService = gameService;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
        Map<String, String> q = parseQuery(session.getUri());
        final String roomCode = q.getOrDefault("roomCode", "demo").trim();
        final String name = q.getOrDefault("participantName", "Guest").trim();
        final String cid = q.getOrDefault("cid", "cid-" + session.getId()).trim();

        log.info("WS OPEN room={} name={} cid={}", roomCode, name, cid);

        // Join (dedupe by name), remember cid mapping, ensure host
        Room room = gameService.join(roomCode, name, cid);

        // Track session so GameService can broadcast to it
        gameService.addSession(session, room);
        gameService.trackParticipant(session, name);

        // Store lightweight local connection info
        bySession.put(session.getId(), new Conn(roomCode, cid, name));

        // Tell the client back its canonical name (in case normalization happened)
        gameService.sendIdentity(session, name, cid);

        // Push full state to everyone in the room
        gameService.broadcastRoomState(room);
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) throws Exception {
        Conn c = bySession.get(session.getId());
        if (c == null) return;

        final String roomCode = c.room;
        final String name = c.name; // stable logical name we track for this session
        final String payload = message.getPayload();

        // Simple line protocol
        if (payload.startsWith("vote:")) {
            // vote:<name>:<val>  (we ignore <name> from the wire, use our tracked one)
            String[] parts = payload.split(":", 3);
            if (parts.length >= 3) {
                String val = parts[2];
                gameService.setVote(roomCode, name, val);
                maybeAutoReveal(roomCode);
                Room room = gameService.getRoom(roomCode);
                if (room != null) gameService.broadcastRoomState(room);
            }
            return;
        }

        switch (payload) {
            case "revealCards" -> {
                gameService.reveal(roomCode);
                Room room = gameService.getRoom(roomCode);
                if (room != null) gameService.broadcastRoomState(room);
            }
            case "resetRoom" -> {
                gameService.reset(roomCode);
                Room room = gameService.getRoom(roomCode);
                if (room != null) gameService.broadcastRoomState(room);
            }
            case "ping" -> {
                gameService.touch(roomCode, name);
            }
            default -> {
                // Topic & participation toggles
                if (payload.startsWith("topicSave:")) {
                    String text = payload.substring("topicSave:".length());
                    gameService.saveTopic(roomCode, decode(text));
                    Room room = gameService.getRoom(roomCode);
                    if (room != null) gameService.broadcastRoomState(room);
                } else if ("topicClear".equals(payload)) {
                    gameService.clearTopic(roomCode);
                    Room room = gameService.getRoom(roomCode);
                    if (room != null) gameService.broadcastRoomState(room);
                } else if (payload.startsWith("topicToggle:")) {
                    boolean on = Boolean.parseBoolean(payload.substring("topicToggle:".length()));
                    gameService.setTopicEnabled(roomCode, on);
                    Room room = gameService.getRoom(roomCode);
                    if (room != null) gameService.broadcastRoomState(room);
                } else if (payload.startsWith("participation:")) {
                    boolean estimating = Boolean.parseBoolean(payload.substring("participation:".length()));
                    gameService.setObserver(roomCode, name, !estimating);
                    Room room = gameService.getRoom(roomCode);
                    if (room != null) gameService.broadcastRoomState(room);
                } else {
                    log.debug("Ignored message: {}", payload);
                }
            }
        }
    }

    @Override
    public void handleTransportError(@NonNull WebSocketSession session, @NonNull Throwable exception) {
        log.warn("WS ERROR sid={} : {}", session.getId(), exception.toString());
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        Conn c = bySession.remove(session.getId());
        if (c == null) return;

        final String roomCode = c.room;
        final String name = c.name;

        log.info("WS CLOSE room={} name={} cid={} code={} reason={}",
                roomCode, name, c.cid, status.getCode(), status.getReason());

        // Drop from GameService’s session maps
        gameService.removeSession(session);

        // Schedule a graceful disconnect (prevents instant host loss / duplicate rows)
        Room room = gameService.getRoom(roomCode);
        if (room != null) {
            gameService.scheduleDisconnect(room, name);
        }

        // Make sure a host exists (reassign if current one truly idle too long)
        gameService.ensureHost(roomCode, 0L, HOST_INACTIVE_MS);

        // Broadcast latest state
        if (room != null) gameService.broadcastRoomState(room);
    }

    /* ---------------- helpers ---------------- */

    private static Map<String, String> parseQuery(URI uri) {
        Map<String, String> map = new HashMap<>();
        if (uri == null || uri.getQuery() == null) return map;
        for (String kv : uri.getQuery().split("&")) {
            int i = kv.indexOf('=');
            if (i > 0) {
                String k = URLDecoder.decode(kv.substring(0, i), StandardCharsets.UTF_8);
                String v = URLDecoder.decode(kv.substring(i + 1), StandardCharsets.UTF_8);
                map.put(k, v);
            }
        }
        return map;
    }

    private static String decode(String s) {
        try {
            return URLDecoder.decode(s, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return s;
        }
    }

    private void maybeAutoReveal(String roomCode) {
        if (gameService.shouldAutoReveal(roomCode)) {
            gameService.reveal(roomCode);
        }
    }

    /** Small immutable connection record. */
    private record Conn(String room, String cid, String name) {
        Conn {
            Objects.requireNonNull(room, "room");
            Objects.requireNonNull(cid, "cid");
            Objects.requireNonNull(name, "name");
        }
    }
}
