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

    // per-session index (room, cid, name); Concurrent for safety
    private final Map<String, Conn> bySession = new ConcurrentHashMap<>();

    // host inactivity threshold (ms) after which we reassign (hard demotion)
    private static final long HOST_INACTIVE_MS = 120_000L;

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

        // Join with CID for sticky identity.
        Room room = gameService.join(roomCode, cid, name);

        // Track session so GameService can broadcast to it.
        gameService.addSession(session, room);
        gameService.trackParticipant(session, name);

        // Store lightweight connection info locally.
        bySession.put(session.getId(), new Conn(roomCode, cid, name));

        // Inform client about canonical name & cid.
        gameService.sendIdentity(session, name, cid);

        // Initial state is broadcast by join(); nothing else to do here.
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session,
                                     @NonNull org.springframework.web.socket.TextMessage message) throws Exception {
        Conn c = bySession.get(session.getId());
        if (c == null) return;

        final String roomCode = c.room;
        final String name     = c.name; // server-side logical name for this session
        final String cid      = c.cid;
        final String payload  = message.getPayload();

        // Simple line protocol with small fan-out
        if (payload.startsWith("vote:")) {
            // vote:<ignoredName>:<val> – we send by CID to keep identity sticky across renames
            String[] parts = payload.split(":", 3);
            if (parts.length >= 3) {
                gameService.setVote(roomCode, cid, parts[2]); // auto-reveal & broadcast in service
            }
            return;
        }

        switch (payload) {
            case "revealCards" -> gameService.reveal(roomCode);         // broadcasted
            case "resetRoom"   -> gameService.reset(roomCode);          // broadcasted
            case "ping"        -> gameService.touch(roomCode, cid);     // heartbeat only (CID-based)
            case "closeRoom"   -> {
                Room room = gameService.getRoom(roomCode);
                if (room != null) {
                    Participant host = room.getHost();
                    boolean isHost = (host != null && Objects.equals(host.getName(), name));
                    if (isHost) {
                        gameService.closeRoom(room); // broadcasts 'roomClosed' and closes all
                    } else {
                        log.warn("closeRoom ignored: {} is not host of {}", name, roomCode);
                    }
                }
            }
            case "intentionalLeave" -> {
                // User navigated away / closed tab intentionally.
                gameService.handleIntentionalLeave(roomCode, name);
            }
            default -> {
                // Parameterized commands
                if (payload.startsWith("sequence:")) {
                    // sequence:<id>  – host only
                    String id = payload.substring("sequence:".length()).trim();
                    if (!id.isEmpty()) {
                        Room room = gameService.getRoom(roomCode);
                        if (room != null && isHost(room, name)) {
                            gameService.setSequence(roomCode, id); // resets round & broadcasts
                        } else {
                            log.warn("sequence ignored (not host): room={} by={}", roomCode, name);
                        }
                    }
                } else if (payload.startsWith("makeHost:")) {
                    // makeHost:<targetName> – host only, promote user
                    String target = decode(payload.substring("makeHost:".length()));
                    Room room = gameService.getRoom(roomCode);
                    if (room != null && isHost(room, name)) {
                        gameService.makeHost(roomCode, target);
                    } else {
                        log.warn("makeHost ignored (not host): room={} by={}", roomCode, name);
                    }
                } else if (payload.startsWith("kick:")) {
                    // kick:<targetName> – host only
                    String target = decode(payload.substring("kick:".length()));
                    Room room = gameService.getRoom(roomCode);
                    if (room != null && isHost(room, name)) {
                        gameService.kickParticipant(room, target);
                    } else {
                        log.warn("kick ignored (not host): room={} by={}", roomCode, name);
                    }
                } else if (payload.startsWith("topicSave:")) {
                    // topic operations are host-only
                    String text = payload.substring("topicSave:".length());
                    Room room = gameService.getRoom(roomCode);
                    if (room != null && isHost(room, name)) {
                        gameService.saveTopic(roomCode, decode(text));           // broadcasts
                    } else {
                        log.warn("topicSave ignored (not host): room={} by={}", roomCode, name);
                    }
                } else if ("topicClear".equals(payload)) {
                    Room room = gameService.getRoom(roomCode);
                    if (room != null && isHost(room, name)) {
                        gameService.clearTopic(roomCode);                        // broadcasts
                    } else {
                        log.warn("topicClear ignored (not host): room={} by={}", roomCode, name);
                    }
                } else if (payload.startsWith("topicToggle:")) {
                    boolean on = Boolean.parseBoolean(payload.substring("topicToggle:".length()));
                    Room room = gameService.getRoom(roomCode);
                    if (room != null && isHost(room, name)) {
                        gameService.setTopicEnabled(roomCode, on);               // broadcasts
                    } else {
                        log.warn("topicToggle ignored (not host): room={} by={}", roomCode, name);
                    }
                } else if (payload.startsWith("participation:")) {
                    boolean estimating = Boolean.parseBoolean(payload.substring("participation:".length()));
                    // participation toggle is user-controlled; map by CID/name
                    gameService.setObserver(roomCode, cid, !estimating);         // broadcasts
                } else if (payload.startsWith("autoReveal:")) {
                    boolean on = Boolean.parseBoolean(payload.substring("autoReveal:".length()));
                    Room room = gameService.getRoom(roomCode);
                    if (room != null && isHost(room, name)) {
                        gameService.setAutoRevealEnabled(roomCode, on);          // broadcasts
                        if (on && gameService.shouldAutoReveal(roomCode)) {
                            gameService.reveal(roomCode);
                        }
                    } else {
                        log.warn("autoReveal ignored (not host): room={} by={}", roomCode, name);
                    }
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
        final String name     = c.name;

        log.info("WS CLOSE room={} name={} cid={} code={} reason={}",
                roomCode, name, c.cid, status.getCode(), status.getReason());

        gameService.removeSession(session);

        Room room = gameService.getRoom(roomCode);
        if (room != null) gameService.scheduleDisconnect(room, name);

        gameService.ensureHost(roomCode, 0L, HOST_INACTIVE_MS);
        // No immediate broadcast; scheduleDisconnect() will handle it.
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

    private static boolean isHost(Room room, String name) {
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
