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

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(GameWebSocketHandler.class);

    private final GameService gameService;

    // Per-session index (room, cid, name)
    private final Map<String, Conn> bySession = new ConcurrentHashMap<>();

    // Hard host reassignment threshold (align with service grace)
    private static final long HOST_INACTIVE_MS = 900_000L; // 15 minutes

    public GameWebSocketHandler(GameService gameService) {
        this.gameService = gameService;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
        try {
            Map<String, String> q = parseQuery(session.getUri());
            final String roomCode = q.getOrDefault("roomCode", "demo").trim();
            final String reqName  = q.getOrDefault("participantName", "Guest").trim();
            final String cid      = q.getOrDefault("cid", "cid-" + session.getId()).trim();

            log.info("WS OPEN room={} requestedName={} cid={}", roomCode, reqName, cid);

            // Join (creates participant if needed or reuses by CID)
            Room room = gameService.join(roomCode, cid, reqName);

            // Determine the canonical/effective name for this CID after join
            String effectiveName = gameService.getClientName(roomCode, cid);
            if (effectiveName == null) {
                Participant p = room != null ? room.getParticipantByCid(cid).orElse(null) : null;
                effectiveName = (p != null ? p.getName() : reqName);
            }

            // Track session with canonical name
            gameService.addSession(session, room);
            gameService.trackParticipant(session, effectiveName);
            bySession.put(session.getId(), new Conn(roomCode, cid, effectiveName));

            // Tell client the canonical identity (keeps header in sync with server name)
            gameService.sendIdentity(session, effectiveName, cid);

            // Try to send an initial snapshot of room state to the just-joined session
            try {
                sendInitialStateSnapshot(session, room, roomCode);
            } catch (Throwable t) {
                log.warn("WS INIT snapshot failed (room={}, name={}): {}", roomCode, effectiveName, t.toString());
            }

            // Note: join() already broadcasted to the room.
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
        final String name     = c.name; // current canonical name for logs
        final String cid      = c.cid;
        final String payload  = message.getPayload();

        try {
            // --- simple line protocol ----------------------------------------------------------

            // Assert/Request rename (client sends this on (re)connect and from UI if you add a form later)
            if (payload.startsWith("rename:")) {
                String desired = decode(payload.substring("rename:".length()));
                String eff = gameService.rename(roomCode, cid, desired);
                if (eff != null) {
                    // refresh local index and session->name mapping
                    bySession.put(session.getId(), new Conn(roomCode, cid, eff));
                    gameService.trackParticipant(session, eff);
                    gameService.sendIdentity(session, eff, cid); // update header immediately
                }
                return;
            }

            if (payload.startsWith("vote:")) {
                // vote:<ignoredName>:<val> — use CID-bound identity for stability
                String[] parts = payload.split(":", 3);
                if (parts.length >= 3) {
                    gameService.setVote(roomCode, cid, parts[2]); // server handles auto-reveal check
                }
                return;
            }

            // ---- RENAME (client identity correction, URL bootstrap etc.) ----
            if (payload.startsWith("rename:")) {
                String nn = decode(payload.substring("rename:".length()));
                if (nn != null) nn = nn.trim();
                if (nn == null || nn.isEmpty()) return;

                // Rejoin binds the same CID to the new display name
                Room room = gameService.join(roomCode, cid, nn);

                // Update our local session index and tracking
                bySession.put(session.getId(), new Conn(roomCode, cid, nn));
                gameService.trackParticipant(session, nn);
                gameService.sendIdentity(session, nn, cid);

                // Send a targeted snapshot so the client immediately sees themselves renamed
                try { sendInitialStateSnapshot(session, room, roomCode); } catch (Throwable t) {
                    log.debug("WS rename snapshot failed: {}", t.toString());
                }
                return;
            }

            if (payload.startsWith("topicSave:")) {
                if (!isHost(roomCode, name)) return;
                String text = payload.substring("topicSave:".length());
                gameService.saveTopic(roomCode, decode(text));     // broadcasts
                return;
            }

            // LEGACY alias kept for backwards compatibility with older clients
            if (payload.startsWith("topicToggle:")) {
                if (!isHost(roomCode, name)) return;
                boolean on = Boolean.parseBoolean(payload.substring("topicToggle:".length()));
                log.debug("WS topicToggle -> room={} on={}", roomCode, on);
                gameService.setTopicEnabled(roomCode, on);         // broadcasts
                return;
            }

            // NEW: current clients send "topicVisible:true|false"
            if (payload.startsWith("topicVisible:")) {
                if (!isHost(roomCode, name)) return;
                boolean on = Boolean.parseBoolean(payload.substring("topicVisible:".length()));
                log.debug("WS topicVisible -> room={} on={}", roomCode, on);
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

            // Keywords
            switch (payload) {
                case "revealCards" -> gameService.reveal(roomCode);       // broadcasts
                case "resetRoom"   -> gameService.reset(roomCode);        // broadcasts
                case "intentionalLeave" -> {
                    // Apply the same 5s grace as a transport close to avoid flapping on quick refresh.
                    try { gameService.handleIntentionalLeave(roomCode, name); } catch (Throwable t) {
                        log.debug("handleIntentionalLeave threw (ignored): {}", t.toString());
                    }
                    Room room = gameService.getRoom(roomCode);
                    if (room != null) {
                        gameService.scheduleDisconnect(room, name); // service should apply ~5s grace
                    }
                }
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
        } catch (Throwable t) {
            log.error("WS handleTextMessage failed (room={}, name={}, payload='{}')",
                    roomCode, name, payload, t);
            try { session.close(CloseStatus.SERVER_ERROR); } catch (Exception ignore) {}
            throw t;
        }
    }

    @Override
    public void handleTransportError(@NonNull WebSocketSession session, @NonNull Throwable exception) {
        // Log full stacktrace to actually see the root cause.
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
        final String name     = c.name;

        log.info("WS CLOSE room={} name={} cid={} code={} reason={}",
                roomCode, name, c.cid, status.getCode(), status.getReason());

        try {
            gameService.removeSession(session);

            Room room = gameService.getRoom(roomCode);
            if (room != null) gameService.scheduleDisconnect(room, name); // 5s grace handled in service

            // Re-evaluate host after hard inactivity threshold (now 15 min)
            gameService.ensureHost(roomCode, 0L, HOST_INACTIVE_MS);
        } catch (Throwable t) {
            log.error("WS afterConnectionClosed handling failed (room={}, name={})", roomCode, name, t);
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

    /** Check if caller is current host. */
    private boolean isHost(String roomCode, String name) {
        Room room = gameService.getRoom(roomCode);
        if (room == null) return false;
        Participant host = room.getHost();
        return host != null && Objects.equals(host.getName(), name);
    }

    /** Try to send an initial state snapshot to the just-joined session (reflection-based, dev-safe). */
    private void sendInitialStateSnapshot(WebSocketSession session, Room room, String roomCode) {
        // Prefer targeted send(Session, Room/String)
        if (tryInvoke(gameService, "sendRoomState", new Class<?>[]{WebSocketSession.class, Room.class}, new Object[]{session, room})) return;
        if (tryInvoke(gameService, "sendRoomState", new Class<?>[]{Room.class, WebSocketSession.class}, new Object[]{room, session})) return;
        if (tryInvoke(gameService, "sendRoomSnapshot", new Class<?>[]{WebSocketSession.class, Room.class}, new Object[]{session, room})) return;
        if (tryInvoke(gameService, "sendRoomSnapshot", new Class<?>[]{Room.class, WebSocketSession.class}, new Object[]{room, session})) return;
        if (tryInvoke(gameService, "sendStateTo", new Class<?>[]{WebSocketSession.class, Room.class}, new Object[]{session, room})) return;
        if (tryInvoke(gameService, "sendStateTo", new Class<?>[]{WebSocketSession.class, String.class}, new Object[]{session, roomCode})) return;

        // Fallback: broadcast room state (new session is now registered and will receive it)
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
            log.debug("WS INIT snapshot via {}({}) ok", name, sig.length == 2 ? (sig[0].getSimpleName() + "," + sig[1].getSimpleName()) : sig[0].getSimpleName());
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
