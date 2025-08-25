package com.example.estpoker.config;

import com.example.estpoker.handler.GameWebSocketHandler;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

  private static final Logger log = LoggerFactory.getLogger(WebSocketConfig.class);

  private final GameWebSocketHandler handler;
  private final List<String> allowedOrigins;

  public WebSocketConfig(
      GameWebSocketHandler handler,
      // CSV aus application.properties / ENV
      @Value("${app.websocket.allowed-origins:https://ep.noxvobiscum.at,http://localhost:8080}") String originsCsv
  ) {
    this.handler = handler;
    this.allowedOrigins = Arrays.stream(originsCsv.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .collect(Collectors.toList());
  }

  @PostConstruct
  void logWsOrigins() {
    log.info("WebSocket allowed origins: {}", allowedOrigins);
  }

  @Override
  public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
    var arr = allowedOrigins.toArray(String[]::new);
    boolean hasWildcard = allowedOrigins.stream().anyMatch(s -> s.contains("*"));
    if (hasWildcard) {
      registry.addHandler(handler, "/gameSocket")
              .setAllowedOriginPatterns(arr);
    } else {
      registry.addHandler(handler, "/gameSocket")
              .setAllowedOrigins(arr);
    }
  }
}
