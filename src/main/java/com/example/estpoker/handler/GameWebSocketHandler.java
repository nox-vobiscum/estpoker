package com.example.estpoker.handler;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.service.GameService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

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
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket handler for /gameSocket.
 * ...
 */
@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(GameWebSocketHandler.class);

    private final GameService gameService;

    /** Per WebSocket session → (room, cid, canonicalName) */
    private final Map<String, Conn> bySession = new ConcurrentHashMap<>();

    /** Host hard demotion safeguard window (should match service). */
    private static final long HOST_INACTIVE_MS = 3_600_000L;

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

            Room existing = gameService.getRoom(roomCode);
            if (existing != null) {
                Participant byName = existing.getParticipant(initialName);
                if (byName != null && byName.isActive()) {
                    var byCid = existing.getParticipantByCid(cid).orElse(null);
                    boolean sameIdentity = (byCid != null && Objects.equals(byCid.getName(), byName.getName()));
                    if (!sameIdentity) {
                        log.warn("WS REJECT room={} name={} already in use by different CID", roomCode, initialName);
                        sendRedirectAndClose(session, inviteUrl(roomCode, initialName, true),
                                new CloseStatus(4005, "Name already in use"));
                        return;
                    }
                }
            }

            Room room = gameService.join(roomCode, cid, initialName);

            String canonicalName = null;
            try {
                var opt = room.getParticipantByCid(cid);
                if (opt.isPresent()) canonicalName = opt.get().getName();
                if (canonicalName == null) canonicalName = gameService.getClientName(roomCode, cid);
            } catch (Throwable ignored) {}
            if (canonicalName == null) canonicalName = initialName;

            gameService.addSession(session, room);
            gameService.trackParticipant(session, canonicalName);
            bySession.put(session.getId(), new Conn(roomCode, cid, canonicalName));
            gameService.sendIdentity(session, canonicalName, cid);

            try {
                sendInitialStateSnapshot(session, room, roomCode);
            } catch (Throwable t) {
                log.warn("WS INIT snapshot failed (room={}, name={}): {}", roomCode, canonicalName, t.toString());
            }

            try {
                replayRosterTo(session, room, canonicalName);
            } catch (Throwable t) {
                log.warn("WS ROSTER replay failed (room={}, to={}): {}", roomCode, canonicalName, t.toString());
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
            if ("ping".equals(payload)) {
                try { gameService.touch(roomCode, cid); } catch (Throwable ignore) {}
                try {
                    if (session.isOpen()) session.sendMessage(new org.springframework.web.socket.TextMessage("pong"));
                } catch (Exception e) {
                    log.warn("WS pong send failed (room={}, name={}, cid={}): {}", roomCode, c.name, cid, e.toString());
                }
                return;
            }

            if ("requestSync".equals(payload)) {
                Room room = gameService.getRoom(roomCode);
                if (room != null) {
                    if (!tryInvoke(gameService, "sendRoomState",
                            new Class<?>[]{WebSocketSession.class, Room.class},
                            new Object[]{session, room})) {
                        gameService.broadcastRoomState(room);
                    }
                }
                return;
            }

            if (payload.startsWith("rename:")) {
                String requested = decode(payload.substring("rename:".length()));
                String finalName = gameService.renameParticipant(roomCode, cid, requested);
                if (finalName == null || finalName.isBlank()) return;

                bySession.put(session.getId(), new Conn(roomCode, cid, finalName));
                gameService.trackParticipant(session, finalName);
                gameService.sendIdentity(session, finalName, cid);
                return;
            }

            if (payload.startsWith("vote:")) {
                String[] parts = payload.split(":", 3);
                if (parts.length >= 3) gameService.setVote(roomCode, cid, parts[2]);
                return;
            }

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

            if (payload.startsWith("participation:")) {
                boolean estimating = Boolean.parseBoolean(payload.substring("participation:".length()));
                gameService.setSpectator(roomCode, cid, !estimating);
                return;
            }

            if (payload.startsWith("autoReveal:")) {
                if (!isHost(roomCode, c.name)) return;
                boolean on = Boolean.parseBoolean(payload.substring("autoReveal:".length()));
                gameService.setAutoRevealEnabled(roomCode, on);
                if (on && gameService.shouldAutoReveal(roomCode)) gameService.reveal(roomCode);
                return;
            }

            // --- FIXED: typisierte JSON-Liste für Specials ---
            if (payload.startsWith("specials:")) {
                if (!isHost(roomCode, c.name)) return;
                String tail = payload.substring("specials:".length()).trim();

                try {
                    String decoded = decode(tail);
                    List<String> list = null;

                    if (decoded.startsWith("[") && decoded.endsWith("]")) {
                        // JSON array → sauber typisiert
                        list = new ObjectMapper().readValue(
                                decoded,
                                new TypeReference<List<String>>() {}
                        );
                    } else if (decoded.contains(",")) {
                        // CSV of emojis
                        list = Arrays.stream(decoded.split(","))
                                     .map(String::trim)
                                     .filter(s -> !s.isEmpty())
                                     .toList();
                    }

                    if (list != null && !list.isEmpty()) {
                        gameService.setSpecialsSelected(roomCode, list);
                        return;
                    }
                } catch (Exception ignore) { /* fall through to boolean */ }

                boolean on = parseOn(tail);
                gameService.setAllowSpecials(roomCode, on);
                return;
            }

            if (payload.startsWith("sequence:") || payload.startsWith("seq:") || payload.startsWith("setSequence:")) {
                if (!isHost(roomCode, c.name)) return;
                String raw = payload.substring(payload.indexOf(':') + 1);
                gameService.setSequence(roomCode, decode(raw));
                return;
            }

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

            switch (payload) {
                case "revealCards" -> gameService.reveal(roomCode);
                case "resetRoom"   -> gameService.reset(roomCode);

                case "intentionalLeave" -> {
                    gameService.handleIntentionalLeave(roomCode, c.name);
                    return;
                }

                case "topicClear" -> {
                    if (!isHost(roomCode, c.name)) return;
                    gameService.clearTopic(roomCode);
                    return;
                }

                case "closeRoom" -> {
                    Room room = gameService.getRoom(roomCode);
                    if (room != null) {
                        Participant host = room.getHost();
                        boolean isHost = (host != null && Objects.equals(host.getName(), c.name));
                        if (isHost) gameService.closeRoom(room);
                        else log.warn("closeRoom ignored: {} is not host of {}", c.name, roomCode);
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
                gameService.scheduleDisconnect(room, c.name);
            }
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
        try { return URLDecoder.decode(s, StandardCharsets.UTF_8); }
        catch (Exception e) { return s; }
    }

    private String safeUri(WebSocketSession session) {
        try { return String.valueOf(session.getUri()); } catch (Exception e) { return "n/a"; }
    }

    private boolean isHost(String roomCode, String name) {
        Room room = gameService.getRoom(roomCode);
        if (room == null) return false;
        Participant host = room.getHost();
        return host != null && Objects.equals(host.getName(), name);
    }

    private void sendInitialStateSnapshot(WebSocketSession session, Room room, String roomCode) {
        if (tryInvoke(gameService, "sendRoomState", new Class<?>[]{WebSocketSession.class, Room.class}, new Object[]{session, room})) return;
        if (tryInvoke(gameService, "sendRoomState", new Class<?>[]{Room.class, WebSocketSession.class}, new Object[]{room, session})) return;
        if (tryInvoke(gameService, "sendRoomSnapshot", new Class<?>[]{WebSocketSession.class, Room.class}, new Object[]{session, room})) return;
        if (tryInvoke(gameService, "sendRoomSnapshot", new Class<?>[]{Room.class, WebSocketSession.class}, new Object[]{room, session})) return;
        if (tryInvoke(gameService, "sendStateTo", new Class<?>[]{WebSocketSession.class, Room.class}, new Object[]{session, room})) return;
        if (tryInvoke(gameService, "sendStateTo", new Class<?>[]{WebSocketSession.class, String.class}, new Object[]{session, roomCode})) return;

        if (tryInvoke(gameService, "broadcastRoom", new Class<?>[]{Room.class}, new Object[]{room})) return;
        if (tryInvoke(gameService, "broadcastRoomState", new Class<?>[]{Room.class}, new Object[]{room})) return;
        if (tryInvoke(gameService, "broadcast", new Class<?>[]{Room.class}, new Object[]{room})) return;

        log.debug("WS INIT snapshot: no suitable GameService method found; skipping explicit snapshot");
    }

    private void replayRosterTo(WebSocketSession session, Room room, String receiverName) {
        List<String> names = extractActiveNames(room);
        names.removeIf(n -> n == null || n.isBlank() || Objects.equals(n, receiverName));
        if (names.isEmpty()) return;

        for (String name : names) {
            try {
                if (session.isOpen()) {
                    session.sendMessage(new org.springframework.web.socket.TextMessage("participantJoined:" + name));
                }
            } catch (Exception e) {
                log.warn("WS ROSTER send failed to {} for {}: {}", receiverName, name, e.toString());
            }
        }
        log.info("WS ROSTER replay to {} ({}): {}", receiverName, names.size(), names);
    }

    private List<String> extractActiveNames(Room room) {
        try {
            Method m = room.getClass().getMethod("getParticipants");
            Object res = m.invoke(room);
            if (res instanceof Map<?, ?> map) {
                List<String> out = new ArrayList<>();
                for (Object v : map.values()) {
                    String n = readNameIfActive(v);
                    if (n != null) out.add(n);
                }
                return out;
            }
            if (res instanceof Collection<?> col) {
                List<String> out = new ArrayList<>();
                for (Object v : col) {
                    String n = readNameIfActive(v);
                    if (n != null) out.add(n);
                }
                return out;
            }
        } catch (Throwable ignored) {}

        try {
            Method m = room.getClass().getMethod("getActiveParticipants");
            Object res = m.invoke(room);
            if (res instanceof Collection<?> col) {
                List<String> out = new ArrayList<>();
                for (Object v : col) {
                    String n = readNameIfActive(v);
                    if (n != null) out.add(n);
                }
                return out;
            }
        } catch (Throwable ignored) {}

        try {
            Method m = room.getClass().getMethod("getParticipantNames");
            Object res = m.invoke(room);
            if (res instanceof Collection<?> col) {
                List<String> out = new ArrayList<>();
                for (Object v : col) if (v != null) out.add(String.valueOf(v));
                return out;
            }
        } catch (Throwable ignored) {}

        try {
            List<Participant> list = room.getParticipants();
            List<String> out = new ArrayList<>();
            for (Participant p : list) {
                if (p != null && p.isActive()) out.add(p.getName());
            }
            return out;
        } catch (Throwable ignored) {}

        return new ArrayList<>();
    }

    private String readNameIfActive(Object maybeParticipant) {
        if (maybeParticipant == null) return null;
        try {
            Method isActive = maybeParticipant.getClass().getMethod("isActive");
            Method getName  = maybeParticipant.getClass().getMethod("getName");
            Object active   = isActive.invoke(maybeParticipant);
            if (active instanceof Boolean b && b) {
                Object n = getName.invoke(maybeParticipant);
                return n == null ? null : String.valueOf(n);
            }
        } catch (Throwable ignored) {}
        return null;
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

    private record Conn(String room, String cid, String name) {
        Conn {
            Objects.requireNonNull(room, "room");
            Objects.requireNonNull(cid, "cid");
            Objects.requireNonNull(name, "name");
        }
    }

    private static String inviteUrl(String roomCode, String participantName, boolean taken) {
        String rc = URLEncoder.encode(roomCode == null ? "" : roomCode, StandardCharsets.UTF_8);
        String pn = URLEncoder.encode(participantName == null ? "" : participantName, StandardCharsets.UTF_8);
        String t  = taken ? "&nameTaken=1" : "";
        return "/invite?roomCode=" + rc + "&participantName=" + pn + t;
    }

    private static String jsonRedirect(String url) {
        String safeUrl = url.replace("\\", "\\\\").replace("\"", "\\\"");
        return "{\"type\":\"kicked\",\"redirect\":\"" + safeUrl + "\"}";
    }

    private void sendRedirectAndClose(WebSocketSession session, String url, CloseStatus status) {
        try {
            String json = jsonRedirect(url);
            if (session.isOpen()) {
                session.sendMessage(new org.springframework.web.socket.TextMessage(json));
            }
        } catch (Exception ignored) { }
        try {
            session.close(status != null ? status : new CloseStatus(4005, "Rejected"));
        } catch (Exception ignored) { }
    }
}
