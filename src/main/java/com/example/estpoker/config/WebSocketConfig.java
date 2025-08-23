package com.example.estpoker.config;

import com.example.estpoker.handler.GameWebSocketHandler;
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

  private final GameWebSocketHandler handler;
  private final List<String> allowedOrigins;

  public WebSocketConfig(
      GameWebSocketHandler handler,
      // Comma-separated list from application.properties / env vars
      @Value("${app.websocket.allowed-origins:https://ep.noxvobsicum.at,http://localhost:8080}") String originsCsv
  ) {
    this.handler = handler;
    this.allowedOrigins = Arrays.stream(originsCsv.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .collect(Collectors.toList());
  }

  @Override
  public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
    var arr = allowedOrigins.toArray(String[]::new);

    // If you ever put wildcards (*) in the list, use patterns API.
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
