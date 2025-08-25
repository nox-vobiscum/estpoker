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
  private final String path;
  private final List<String> allowedOrigins;
  private final boolean debugOpen;

  public WebSocketConfig(
      GameWebSocketHandler handler,
      @Value("${app.websocket.path:/gameSocket}") String path,
      @Value("${app.websocket.allowed-origins:}") String originsCsv,
      @Value("${app.websocket.debug-open:false}") boolean debugOpen
  ) {
    this.handler = handler;
    this.path = (path == null || path.isBlank()) ? "/gameSocket" : path.trim();
    this.debugOpen = debugOpen;
    this.allowedOrigins = Arrays.stream(originsCsv.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .collect(Collectors.toList());
  }

  @Override
  public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
    var registration = registry.addHandler(handler, path);

    if (debugOpen || allowedOrigins.contains("*")) {
      // Dev fallback: allow any origin (DO NOT enable in prod)
      registration.setAllowedOriginPatterns("*");
      return;
    }

    if (!allowedOrigins.isEmpty()) {
      // Exact origins (best for prod)
      registration.setAllowedOrigins(allowedOrigins.toArray(String[]::new));
    } else {
      // If list is empty, be permissive during setup to avoid a hard lockout
      registration.setAllowedOriginPatterns("*");
    }
  }
}
