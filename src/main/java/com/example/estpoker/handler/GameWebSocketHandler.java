package com.example.estpoker.handler;

import com.example.estpoker.model.Room;
import com.example.estpoker.service.GameService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.util.Arrays;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    @Autowired
    private GameService gameService;

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
        super.afterConnectionEstablished(session);
        System.out.println("Neue WebSocket-Verbindung: " + session.getId());

        gameService.registerSession(session);

        URI uri = session.getUri();
        if (uri != null) {
            String query = uri.getQuery();
            if (query != null) {
                Map<String, String> params = Arrays.stream(query.split("&"))
                        .map(s -> s.split("="))
                        .filter(p -> p.length == 2)
                        .collect(Collectors.toMap(p -> p[0], p -> p[1]));

                String roomCode = params.get("roomCode");
                String participantName = params.get("participantName");
                if (roomCode != null && participantName != null) {
                    gameService.assignSessionToRoom(session, roomCode);
                    gameService.getOrCreateRoom(roomCode).getOrCreateParticipant(participantName);
                    System.out.println("Session wurde Raum '" + roomCode + "' zugeordnet.");

                    Room room = gameService.getRoomFromSession(session);
                    if (room != null) {
                        String updateMessage = gameService.buildVoteUpdateJson(room);
                        gameService.broadcastToRoom(room, updateMessage);
                    }
                }
            }
        }
    }

    @Override
    public void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) throws Exception {
        String messageContent = message.getPayload();
        System.out.println("Nachricht vom Client: " + messageContent);

        Room room = gameService.getRoomFromSession(session);
        if (room == null) return;

        if (messageContent.equals("revealCards")) {
            gameService.revealCards(room.getCode());
            String revealJson = gameService.buildRevealJson(room);
            gameService.broadcastToRoom(room, revealJson);
            System.out.println("Karten wurden aufgedeckt für Raum: " + room.getCode());

        } else if (messageContent.startsWith("vote:")) {
            String[] parts = messageContent.split(":");
            if (parts.length >= 3) {
                String participantName = parts[1];
                String cardValue = parts[2];

                gameService.storeCardValue(session, participantName, cardValue);
                String jsonMessage = gameService.buildVoteUpdateJson(room);
                gameService.broadcastToRoom(room, jsonMessage);
            }

        } else if (messageContent.equals("resetRoom")) {
            gameService.resetVotes(room.getCode());
            String jsonMessage = gameService.buildVoteUpdateJson(room);
            gameService.broadcastToRoom(room, jsonMessage);
            System.out.println("Raum '" + room.getCode() + "' wurde zurückgesetzt.");
        }
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) throws Exception {
        super.afterConnectionClosed(session, status);
        gameService.removeSession(session);
        System.out.println("Verbindung geschlossen: " + session.getId() + ", Status: " + status);
    }
}
