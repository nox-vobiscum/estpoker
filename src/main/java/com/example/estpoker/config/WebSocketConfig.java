package com.example.estpoker.config;

import com.example.estpoker.handler.GameWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.*;
import java.util.stream.Collectors;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

  private final GameWebSocketHandler handler;
  private final List<String> originPatterns;
  private final String wsPath;
  private final boolean allowAll;

  public WebSocketConfig(
      GameWebSocketHandler handler,
      // configurable path (must match room.html)
      @Value("${app.websocket.path:/gameSocket}") String wsPath,
      // CSV list; we’ll convert to patterns to avoid strict equality pitfalls
      @Value("${app.websocket.allowed-origins:https://ep.noxvobsicum.at,http://localhost:8080}") String originsCsv,
      // quick switch to allow * during troubleshooting
      @Value("${app.websocket.debug-open:false}") boolean allowAll
  ) {
    this.handler = handler;
    this.wsPath = wsPath;
    this.allowAll = allowAll;

    List<String> list = Arrays.stream(originsCsv.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .flatMap(s -> expandToPatterns(s).stream())
        .distinct()
        .collect(Collectors.toList());

    this.originPatterns = list.isEmpty() ? Collections.singletonList("*") : list;
  }

  // Expand a few helpful variants into patterns (esp. localhost)
  private static List<String> expandToPatterns(String origin) {
    List<String> out = new ArrayList<>();
    if ("*".equals(origin)) { out.add("*"); return out; }
    out.add(origin);
    if (origin.startsWith("http://localhost")) {
      out.add("http://localhost:*");
      out.add("http://127.0.0.1:*");
    }
    if (origin.startsWith("https://localhost")) {
      out.add("https://localhost:*");
    }
    return out;
  }

  @Override
  public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
    String[] patterns = allowAll ? new String[] {"*"} : originPatterns.toArray(String[]::new);

    // Always use origin patterns; more robust across ports/subdomains/proxies.
    registry.addHandler(handler, wsPath)
            .setAllowedOriginPatterns(patterns);
  }
}
