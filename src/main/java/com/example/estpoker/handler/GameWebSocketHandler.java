package com.example.estpoker.handler;

import com.example.estpoker.model.Room;
import com.example.estpoker.service.GameService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.stereotype.Component;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    @Autowired
    private GameService gameService;

    @Override
    public void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) throws Exception {
        String messageContent = message.getPayload();
        System.out.println("Nachricht vom Client: " + messageContent);

        // Wenn der Host die Karten aufdeckt
        if (messageContent.equals("revealCards")) {
            Room room = gameService.getRoomFromSession(session);  // Hole den Raum anhand der Session
            if (room != null) {
                gameService.revealCards(room.getCode());  // Aufdecken der Karten
                gameService.broadcastToAllSessions("Karten wurden aufgedeckt");  // Benachrichtige alle Clients
            }
        } else if (messageContent.startsWith("vote:")) {
            // Verarbeiten der Kartenwahl (z.B. vote:ParticipantName:CardValue)
            String[] parts = messageContent.split(":");
            String participantName = parts[1];
            String cardValue = parts[2];
            Room room = gameService.getRoomFromSession(session);  // Hole den Raum anhand der Session
            if (room != null) {
                gameService.storeCardValue(participantName, cardValue);  // Speichern der Kartenwahl
                gameService.broadcastToAllSessions(participantName + " hat die Karte " + cardValue + " gewählt");
            }
        }
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull org.springframework.web.socket.CloseStatus status) throws Exception {
        super.afterConnectionClosed(session, status);
        System.out.println("Verbindung geschlossen: " + session.getId());
    }
}
