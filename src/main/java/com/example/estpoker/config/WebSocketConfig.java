package com.example.estpoker.config;

import com.example.estpoker.handler.GameWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Registers our WebSocket endpoint and ties it to the handler.
 * Keep this class small – all runtime logic lives in the handler/service.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final GameWebSocketHandler gameWebSocketHandler;

    public WebSocketConfig(GameWebSocketHandler gameWebSocketHandler) {
        this.gameWebSocketHandler = gameWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        registry.addHandler(gameWebSocketHandler, "/gameSocket")
                // NOTE: For dev we allow all origins. In production, lock this down
                // to your actual origins (e.g. setAllowedOrigins("https://app.example.com")).
                .setAllowedOrigins("*");
        // If you proxy through SockJS, you could also add .withSockJS() here – not needed for native WS.
    }
}
