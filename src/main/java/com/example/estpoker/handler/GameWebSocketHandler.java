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

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    @Autowired
    private GameService gameService;

    @Override
    public void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) throws Exception {
        String messageContent = message.getPayload();
        System.out.println("Nachricht vom Client: " + messageContent);

        // 🟡 Karten aufdecken (vom Host)
        if (messageContent.equals("revealCards")) {
            Room room = gameService.getRoomFromSession(session);
            if (room != null) {
                gameService.revealCards(room.getCode());

                // 📤 Jetzt JSON-Nachricht mit aufgedeckten Karten und Durchschnitt senden
                String jsonMessage = gameService.buildVoteUpdateJson(room);
                gameService.broadcastToAllSessions(jsonMessage);

                System.out.println("Karten wurden aufgedeckt für Raum: " + room.getCode());
            }
        }

        // 🟢 Teilnehmer wählt eine Karte
        else if (messageContent.startsWith("vote:")) {
            String[] parts = messageContent.split(":");
            if (parts.length >= 3) {
                String participantName = parts[1];
                String cardValue = parts[2];

                Room room = gameService.getRoomFromSession(session);
                if (room != null) {
                    gameService.storeCardValue(session, participantName, cardValue);

                    // 📤 Aktuellen Zustand an alle Clients senden (JSON mit Teilnehmern + Durchschnitt)
                    String jsonMessage = gameService.buildVoteUpdateJson(room);
                    gameService.broadcastToAllSessions(jsonMessage);
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) throws Exception {
        super.afterConnectionClosed(session, status);
        System.out.println("Verbindung geschlossen: " + session.getId());
        System.out.println("Verbindung geschlossen, Status: " + status);
    }
}
