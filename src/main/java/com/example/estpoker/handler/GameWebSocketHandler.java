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

    private final Map<String, Conn> bySession = new ConcurrentHashMap<>();

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

        Room room = gameService.join(roomCode, cid, name);

        gameService.addSession(session, room);
        gameService.trackParticipant(session, name);

        bySession.put(session.getId(), new Conn(roomCode, cid, name));

        gameService.sendIdentity(session, name, cid);
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

        if (payload.startsWith("vote:")) {
            String[] parts = payload.split(":", 3);
            if (parts.length >= 3) {
                gameService.setVote(roomCode, cid, parts[2]); // use CID mapping
            }
            return;
        }

        switch (payload) {
            case "revealCards" -> gameService.reveal(roomCode);
            case "resetRoom"   -> gameService.reset(roomCode);
            case "ping"        -> gameService.touch(roomCode, cid);
            case "leave"       -> {
                Room room = gameService.getRoom(roomCode);
                if (room != null) gameService.scheduleIntentionalLeave(room, name, 2000L); // short grace
            }
            case "closeRoom"   -> {
                Room room = gameService.getRoom(roomCode);
                if (room != null) {
                    Participant host = room.getHost();
                    boolean isHost = (host != null && Objects.equals(host.getName(), name));
                    if (isHost) {
                        gameService.closeRoom(room);
                    } else {
                        log.warn("closeRoom ignored: {} is not host of {}", name, roomCode);
                    }
                }
            }
            default -> {
                if (payload.startsWith("topicSave:")) {
                    String text = payload.substring("topicSave:".length());
                    Room room = gameService.getRoom(roomCode);
                    if (room != null) {
                        Participant host = room.getHost();
                        boolean isHost = (host != null && Objects.equals(host.getName(), name));
                        if (isHost) gameService.saveTopic(roomCode, decode(text));
                        else log.warn("topicSave ignored: {} is not host of {}", name, roomCode);
                    }
                } else if ("topicClear".equals(payload)) {
                    Room room = gameService.getRoom(roomCode);
                    if (room != null) {
                        Participant host = room.getHost();
                        boolean isHost = (host != null && Objects.equals(host.getName(), name));
                        if (isHost) gameService.clearTopic(roomCode);
                        else log.warn("topicClear ignored: {} is not host of {}", name, roomCode);
                    }
                } else if (payload.startsWith("topicToggle:")) {
                    boolean on = Boolean.parseBoolean(payload.substring("topicToggle:".length()));
                    Room room = gameService.getRoom(roomCode);
                    if (room != null) {
                        Participant host = room.getHost();
                        boolean isHost = (host != null && Objects.equals(host.getName(), name));
                        if (isHost) gameService.setTopicEnabled(roomCode, on);
                        else log.warn("topicToggle ignored: {} is not host of {}", name, roomCode);
                    }
                } else if (payload.startsWith("participation:")) {
                    boolean estimating = Boolean.parseBoolean(payload.substring("participation:".length()));
                    gameService.setObserver(roomCode, cid, !estimating);
                } else if (payload.startsWith("autoReveal:")) {
                    boolean on = Boolean.parseBoolean(payload.substring("autoReveal:".length()));
                    Room room = gameService.getRoom(roomCode);
                    if (room != null) {
                        Participant host = room.getHost();
                        boolean isHost = (host != null && Objects.equals(host.getName(), name));
                        if (isHost) {
                            synchronized (room) { room.setAutoRevealEnabled(on); }
                            gameService.broadcastRoomState(room);
                            if (on && gameService.shouldAutoReveal(roomCode)) gameService.reveal(roomCode);
                        } else {
                            log.warn("autoReveal ignored: {} is not host of {}", name, roomCode);
                        }
                    }
                } else if (payload.startsWith("sequence:")) {
                    String id = payload.substring("sequence:".length());
                    Room room = gameService.getRoom(roomCode);
                    if (room != null) {
                        Participant host = room.getHost();
                        boolean isHost = (host != null && Objects.equals(host.getName(), name));
                        if (isHost) gameService.setSequence(roomCode, id);
                        else log.warn("sequence change ignored: {} is not host of {}", name, roomCode);
                    }
                } else if (payload.startsWith("makeHost:")) {
                    String target = payload.substring("makeHost:".length());
                    Room room = gameService.getRoom(roomCode);
                    if (room != null) {
                        Participant host = room.getHost();
                        boolean isHost = (host != null && Objects.equals(host.getName(), name));
                        if (isHost) gameService.assignHost(roomCode, target);
                        else log.warn("makeHost ignored: {} is not host of {}", name, roomCode);
                    }
                } else if (payload.startsWith("kick:")) {
                    String target = payload.substring("kick:".length());
                    Room room = gameService.getRoom(roomCode);
                    if (room != null) {
                        Participant host = room.getHost();
                        boolean isHost = (host != null && Objects.equals(host.getName(), name));
                        if (isHost) gameService.kickParticipant(room, target);
                        else log.warn("kick ignored: {} is not host of {}", name, roomCode);
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

    /** Small immutable connection record. */
    private record Conn(String room, String cid, String name) {
        Conn {
            Objects.requireNonNull(room, "room");
            Objects.requireNonNull(cid, "cid");
            Objects.requireNonNull(name, "name");
        }
    }
}
