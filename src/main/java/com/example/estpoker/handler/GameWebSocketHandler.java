package com.example.estpoker.handler;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.service.GameService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(GameWebSocketHandler.class);

    private final GameService gameService;

    // Per-session index (room, cid, name)
    private final Map<String, Conn> bySession = new ConcurrentHashMap<>();

    // Hard host reassignment threshold (align with service grace)
    private static final long HOST_INACTIVE_MS = 600_000L; // 10 minutes

    public GameWebSocketHandler(GameService gameService) {
        this.gameService = gameService;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
        Map<String, String> q = parseQuery(session.getUri());
        final String roomCode = q.getOrDefault("roomCode", "demo").trim();
        final String name     = q.getOrDefault("participantName", "Guest").trim();
        final String cid      = q.getOrDefault("cid", "cid-" + session.getId()).trim();

        log.info("WS OPEN room={} name={} cid={}", roomCode, name, cid);

        // Join with (roomCode, cid, name)
        Room room = gameService.join(roomCode, cid, name);

        // Track session
        gameService.addSession(session, room);
        gameService.trackParticipant(session, name);

        // Store local index
        bySession.put(session.getId(), new Conn(roomCode, cid, name));

        // Tell client the canonical identity
        gameService.sendIdentity(session, name, cid);
        // Note: join() already broadcasts the room state.
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session,
                                     @NonNull org.springframework.web.socket.TextMessage message) throws Exception {
        Conn c = bySession.get(session.getId());
        if (c == null) return;

        final String roomCode = c.room;
        final String name     = c.name;
        final String cid      = c.cid;
        final String payload  = message.getPayload();

        // Simple line protocol
        if (payload.startsWith("vote:")) {
            // vote:<ignoredName>:<val>  – use CID-bound identity for stability
            String[] parts = payload.split(":", 3);
            if (parts.length >= 3) {
                gameService.setVote(roomCode, cid, parts[2]); // server handles auto-reveal check
            }
            return;
        }

        if (payload.startsWith("topicSave:")) {
            if (!isHost(roomCode, name)) return;
            String text = payload.substring("topicSave:".length());
            gameService.saveTopic(roomCode, decode(text));     // broadcasts
            return;
        }

        if (payload.startsWith("topicToggle:")) {
            if (!isHost(roomCode, name)) return;
            boolean on = Boolean.parseBoolean(payload.substring("topicToggle:".length()));
            gameService.setTopicEnabled(roomCode, on);         // broadcasts
            return;
        }

        if (payload.startsWith("participation:")) {
            boolean estimating = Boolean.parseBoolean(payload.substring("participation:".length()));
            gameService.setObserver(roomCode, cid, !estimating); // broadcasts
            return;
        }

        if (payload.startsWith("autoReveal:")) {
            if (!isHost(roomCode, name)) return;
            boolean on = Boolean.parseBoolean(payload.substring("autoReveal:".length()));
            gameService.setAutoRevealEnabled(roomCode, on);     // broadcasts
            // If already all votes present, reveal immediately
            if (on && gameService.shouldAutoReveal(roomCode)) {
                gameService.reveal(roomCode);
            }
            return;
        }

        if (payload.startsWith("sequence:")) {
            if (!isHost(roomCode, name)) return;
            String id = decode(payload.substring("sequence:".length()));
            gameService.setSequence(roomCode, id);              // sets, resets round, broadcasts
            return;
        }

        if (payload.startsWith("makeHost:")) {
            if (!isHost(roomCode, name)) return;
            String target = decode(payload.substring("makeHost:".length()));
            gameService.makeHost(roomCode, target);             // assigns & broadcasts
            return;
        }

        if (payload.startsWith("kick:")) {
            if (!isHost(roomCode, name)) return;
            String target = decode(payload.substring("kick:".length()));
            Room room = gameService.getRoom(roomCode);
            if (room != null) gameService.kickParticipant(room, target);
            return;
        }

        // Switch on simple keywords
        switch (payload) {
            case "revealCards" -> gameService.reveal(roomCode);       // broadcasts
            case "resetRoom"   -> gameService.reset(roomCode);        // broadcasts
            case "intentionalLeave" -> gameService.handleIntentionalLeave(roomCode, name); // best-effort leave
            case "ping"        -> gameService.touch(roomCode, cid);   // CID-based heartbeat
            case "topicClear"  -> {                                    // host-only
                if (!isHost(roomCode, name)) return;
                gameService.clearTopic(roomCode);                     // broadcasts
            }
            case "closeRoom"   -> {
                Room room = gameService.getRoom(roomCode);
                if (room != null) {
                    Participant host = room.getHost();
                    boolean isHost = (host != null && Objects.equals(host.getName(), name));
                    if (isHost) {
                        gameService.closeRoom(room);                  // broadcasts + closes sessions
                    } else {
                        log.warn("closeRoom ignored: {} is not host of {}", name, roomCode);
                    }
                }
            }
            default -> log.debug("Ignored message: {}", payload);
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
        final String name     = c.name;

        log.info("WS CLOSE room={} name={} cid={} code={} reason={}",
                roomCode, name, c.cid, status.getCode(), status.getReason());

        gameService.removeSession(session);

        Room room = gameService.getRoom(roomCode);
        if (room != null) gameService.scheduleDisconnect(room, name);

        // Re-evaluate host after grace; hard demotion uses threshold
        gameService.ensureHost(roomCode, 0L, HOST_INACTIVE_MS);
    }

    /* ---------------- helpers ---------------- */

    private static Map<String, String> parseQuery(URI uri) {
        Map<String, String> map = new ConcurrentHashMap<>();
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

    /** Check if caller is current host. */
    private boolean isHost(String roomCode, String name) {
        Room room = gameService.getRoom(roomCode);
        if (room == null) return false;
        Participant host = room.getHost();
        return host != null && Objects.equals(host.getName(), name);
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
