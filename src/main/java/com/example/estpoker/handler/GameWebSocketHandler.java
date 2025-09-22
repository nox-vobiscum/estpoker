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

import java.lang.reflect.Method;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Locale;

/**
 * WebSocket handler for /gameSocket.
 * - Joins by roomCode + cid + requested name (service enforces canonical/unique name)
 * - Handles rename:<name> (service broadcasts participantRenamed + we send you{yourName})
 * - Handles intentionalLeave (service: immediate participantLeft toast + short-grace disconnect)
 * - For transport close: schedules grace disconnect (service broadcasts after grace)
 * - Keeps back-compat for legacy messages used in tests
 */
@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(GameWebSocketHandler.class);

    private final GameService gameService;

    /** Per WebSocket session → (room, cid, canonicalName) */
    private final Map<String, Conn> bySession = new ConcurrentHashMap<>();

    /** Hard host reassignment threshold (keep consistent with service logic – currently 60 min). */
    private static final long HOST_INACTIVE_MS = 3_600_000L;

    // accept a few common truthy/falsy spellings for boolean toggles.
    private static boolean parseOn(String s) {
        if (s == null) return false;
        switch (s.trim().toLowerCase(Locale.ROOT)) {
        case "1": case "true": case "on": case "yes": case "y":  return true;
        case "0": case "false": case "off": case "no": case "n": return false;
        default: return Boolean.parseBoolean(s);
        }
    }

    public GameWebSocketHandler(GameService gameService) {
        this.gameService = gameService;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
        try {
            Map<String, String> q = parseQuery(session.getUri());
            final String roomCode    = q.getOrDefault("roomCode", "demo").trim();
            final String initialName = q.getOrDefault("participantName", "Guest").trim();
            final String cid         = q.getOrDefault("cid", "cid-" + session.getId()).trim();

            log.info("WS OPEN room={} name={} cid={}", roomCode, initialName, cid);

            // Join with (roomCode, cid, requestedName). Service enforces a unique/canonical name.
            Room room = gameService.join(roomCode, cid, initialName);

            // Resolve canonical/effective name for this CID after join.
            String canonicalName = null;
            try {
                var opt = room.getParticipantByCid(cid);
                if (opt.isPresent()) canonicalName = opt.get().getName();
                if (canonicalName == null) canonicalName = gameService.getClientName(roomCode, cid);
            } catch (Throwable ignored) {}
            if (canonicalName == null) canonicalName = initialName;

            // Track this session.
            gameService.addSession(session, room);
            gameService.trackParticipant(session, canonicalName);

            // Local index.
            bySession.put(session.getId(), new Conn(roomCode, cid, canonicalName));

            // Tell the client its canonical identity (may differ from request on collisions).
            gameService.sendIdentity(session, canonicalName, cid);

            // Initial snapshot to just-joined session (reflection to keep BC with service).
            try {
                sendInitialStateSnapshot(session, room, roomCode);
            } catch (Throwable t) {
                log.warn("WS INIT snapshot failed (room={}, name={}): {}", roomCode, canonicalName, t.toString());
            }
        } catch (Throwable t) {
            log.error("WS afterConnectionEstablished failed (sid={}, uri={})", session.getId(), safeUri(session), t);
            try { session.close(CloseStatus.SERVER_ERROR); } catch (Exception ignore) {}
            throw t;
        }
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session,
                                     @NonNull org.springframework.web.socket.TextMessage message) throws Exception {
        Conn c = bySession.get(session.getId());
        if (c == null) {
            log.warn("WS message from unknown session sid={} payload={}", session.getId(), message.getPayload());
            return;
        }

        final String roomCode = c.room;
        final String cid      = c.cid;
        final String payload  = message.getPayload();

        try {
            // ----------------------------------------------------------------------------
            // RENAME: "rename:<urlEncodedName>" → service canonicalizes; it broadcasts rename.
            // ----------------------------------------------------------------------------
            if (payload.startsWith("rename:")) {
                String requested = decode(payload.substring("rename:".length()));
                String finalName = gameService.renameParticipant(roomCode, cid, requested);
                if (finalName == null || finalName.isBlank()) return;

                // Update local/session tracking.
                bySession.put(session.getId(), new Conn(roomCode, cid, finalName));
                gameService.trackParticipant(session, finalName);
                gameService.sendIdentity(session, finalName, cid);
                return;
            }

            // ----------------------------------------------------------------------------
            // VOTE: "vote:<ignoredName>:<value>" (identity bound to CID server-side)
            // ----------------------------------------------------------------------------
            if (payload.startsWith("vote:")) {
                String[] parts = payload.split(":", 3);
                if (parts.length >= 3) {
                    gameService.setVote(roomCode, cid, parts[2]);
                }
                return;
            }

            // ----------------------------------------------------------------------------
            // TOPIC: save / toggle (host only)
            // ----------------------------------------------------------------------------
            if (payload.startsWith("topicSave:")) {
                if (!isHost(roomCode, c.name)) return;
                String text = payload.substring("topicSave:".length());
                gameService.saveTopic(roomCode, decode(text));
                return;
            }
            if (payload.startsWith("topicVisible:")) {
                if (!isHost(roomCode, c.name)) return;
                boolean on = Boolean.parseBoolean(payload.substring("topicVisible:".length()));
                gameService.setTopicEnabled(roomCode, on);
                return;
            }

            // ----------------------------------------------------------------------------
            // PARTICIPATION toggle
            // ----------------------------------------------------------------------------
            if (payload.startsWith("participation:")) {
                boolean estimating = Boolean.parseBoolean(payload.substring("participation:".length()));
                gameService.setSpectator(roomCode, cid, !estimating);
                return;
            }

            // ----------------------------------------------------------------------------
            // AUTO-REVEAL toggle (host)
            // ----------------------------------------------------------------------------
            if (payload.startsWith("autoReveal:")) {
                if (!isHost(roomCode, c.name)) return;
                boolean on = Boolean.parseBoolean(payload.substring("autoReveal:".length()));
                gameService.setAutoRevealEnabled(roomCode, on);
                if (on && gameService.shouldAutoReveal(roomCode)) {
                    gameService.reveal(roomCode);
                }
                return;
            }
        
            // ----------------------------------------------------------------------------
            // SPECIALS toggle (host) – room-wide
            // ----------------------------------------------------------------------------
            if (payload.startsWith("specials:")) {
                if (!isHost(roomCode, c.name)) return;
                boolean on = parseOn(payload.substring("specials:".length()));
                gameService.setAllowSpecials(roomCode, on);
                return;
            }

            // ----------------------------------------------------------------------------
            // SEQUENCE change (host)
            // ----------------------------------------------------------------------------
            if (payload.startsWith("sequence:")) {
                if (!isHost(roomCode, c.name)) return;
                String id = decode(payload.substring("sequence:".length()));
                gameService.setSequence(roomCode, id);
                return;
            }

            // ----------------------------------------------------------------------------
            // HOST / KICK (host)
            // ----------------------------------------------------------------------------
            if (payload.startsWith("makeHost:")) {
                if (!isHost(roomCode, c.name)) return;
                String target = decode(payload.substring("makeHost:".length()));
                gameService.makeHost(roomCode, target);
                return;
            }
            if (payload.startsWith("kick:")) {
                if (!isHost(roomCode, c.name)) return;
                String target = decode(payload.substring("kick:".length()));
                Room room = gameService.getRoom(roomCode);
                if (room != null) gameService.kickParticipant(room, target);
                return;
            }

            // ----------------------------------------------------------------------------
            // Keywords
            // ----------------------------------------------------------------------------
            switch (payload) {
                case "revealCards" -> gameService.reveal(roomCode);
                case "resetRoom"   -> gameService.reset(roomCode);

                case "intentionalLeave" -> {
                    // Only tell service; it broadcasts leave + manages host transfer.
                    gameService.handleIntentionalLeave(roomCode, c.name);
                    return;
                }

                case "ping"       -> gameService.touch(roomCode, cid);

                case "topicClear" -> {
                    if (!isHost(roomCode, c.name)) return;
                    gameService.clearTopic(roomCode);
                    return;
                }

                case "closeRoom"  -> {
                    Room room = gameService.getRoom(roomCode);
                    if (room != null) {
                        Participant host = room.getHost();
                        boolean isHost = (host != null && Objects.equals(host.getName(), c.name));
                        if (isHost) {
                            gameService.closeRoom(room);
                        } else {
                            log.warn("closeRoom ignored: {} is not host of {}", c.name, roomCode);
                        }
                    }
                    return;
                }

                default -> log.debug("Ignored message: {}", payload);
            }
        } catch (Throwable t) {
            log.error("WS handleTextMessage failed (room={}, name={}, payload='{}')",
                    roomCode, c.name, payload, t);
            try { session.close(CloseStatus.SERVER_ERROR); } catch (Exception ignore) {}
            throw t;
        }
    }

    @Override
    public void handleTransportError(@NonNull WebSocketSession session, @NonNull Throwable exception) {
        log.error("WS ERROR sid={} uri={} : transport error", session.getId(), safeUri(session), exception);
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        Conn c = bySession.remove(session.getId());
        if (c == null) {
            log.info("WS CLOSE sid={} code={} reason={}", session.getId(), status.getCode(), status.getReason());
            return;
        }
        final String roomCode = c.room;

        log.info("WS CLOSE room={} name={} cid={} code={} reason={}",
                roomCode, c.name, c.cid, status.getCode(), status.getReason());

        try {
            gameService.removeSession(session);
            Room room = gameService.getRoom(roomCode);
            if (room != null) {
                // Do NOT broadcast leave immediately here (grace on unexpected close).
                gameService.scheduleDisconnect(room, c.name);
            }
            // Host hard demotion safeguard (60 min inactivity).
            gameService.ensureHost(roomCode, 0L, HOST_INACTIVE_MS);
        } catch (Throwable t) {
            log.error("WS afterConnectionClosed handling failed (room={}, name={})", roomCode, c.name, t);
        }
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

    private String safeUri(WebSocketSession session) {
        try { return String.valueOf(session.getUri()); } catch (Exception e) { return "n/a"; }
    }

    /** Check if caller is current host (by name). */
    private boolean isHost(String roomCode, String name) {
        Room room = gameService.getRoom(roomCode);
        if (room == null) return false;
        Participant host = room.getHost();
        return host != null && Objects.equals(host.getName(), name);
    }

    /** Try to send an initial state snapshot to the just-joined session (reflection-based, dev-safe). */
    private void sendInitialStateSnapshot(WebSocketSession session, Room room, String roomCode) {
        if (tryInvoke(gameService, "sendRoomState", new Class<?>[]{WebSocketSession.class, Room.class}, new Object[]{session, room})) return;
        if (tryInvoke(gameService, "sendRoomState", new Class<?>[]{Room.class, WebSocketSession.class}, new Object[]{room, session})) return;
        if (tryInvoke(gameService, "sendRoomSnapshot", new Class<?>[]{WebSocketSession.class, Room.class}, new Object[]{session, room})) return;
        if (tryInvoke(gameService, "sendRoomSnapshot", new Class<?>[]{Room.class, WebSocketSession.class}, new Object[]{room, session})) return;
        if (tryInvoke(gameService, "sendStateTo", new Class<?>[]{WebSocketSession.class, Room.class}, new Object[]{session, room})) return;
        if (tryInvoke(gameService, "sendStateTo", new Class<?>[]{WebSocketSession.class, String.class}, new Object[]{session, roomCode})) return;

        // Fallback: broadcast room state (new session is registered and will receive it)
        if (tryInvoke(gameService, "broadcastRoom", new Class<?>[]{Room.class}, new Object[]{room})) return;
        if (tryInvoke(gameService, "broadcastRoomState", new Class<?>[]{Room.class}, new Object[]{room})) return;
        if (tryInvoke(gameService, "broadcast", new Class<?>[]{Room.class}, new Object[]{room})) return;

        log.debug("WS INIT snapshot: no suitable GameService method found; skipping explicit snapshot");
    }

    private boolean tryInvoke(Object target, String name, Class<?>[] sig, Object[] args) {
        try {
            Method m = target.getClass().getMethod(name, sig);
            m.setAccessible(true);
            m.invoke(target, args);
            log.debug("WS INIT snapshot via {}({}) ok",
                    name,
                    sig.length == 2 ? (sig[0].getSimpleName() + "," + sig[1].getSimpleName())
                                    : sig[0].getSimpleName());
            return true;
        } catch (NoSuchMethodException ignored) {
            return false;
        } catch (Throwable t) {
            log.warn("WS INIT snapshot: {} invocation failed: {}", name, t.toString());
            return false;
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
