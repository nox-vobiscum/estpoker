package com.example.estpoker;

import com.example.estpoker.rooms.repo.RoomStore;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "features.persistentRooms.snapshot.enabled=false")
class ApplicationSmokeTest {
    @LocalServerPort
    private int port;

    @MockitoBean
    private RoomStore roomStore;

    @Test
    void servesTemplatesJsonAndWebSocketRoomState() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            String base = "http://localhost:" + port;
            for (String path : new String[]{"/", "/healthz", "/sequences",
                    "/room?roomCode=boot-smoke&participantName=Host"}) {
                var response = client.send(HttpRequest.newBuilder(URI.create(base + path))
                        .timeout(Duration.ofSeconds(10)).GET().build(), HttpResponse.BodyHandlers.ofString());
                assertEquals(200, response.statusCode(), path);
                if (path.equals("/healthz")) assertEquals("ok", response.body());
                if (path.equals("/sequences")) {
                    assertFalse(new JsonMapper().readTree(response.body()).path("sequences").isEmpty());
                }
                if (path.startsWith("/room")) assertTrue(response.body().contains("cardGrid"));
            }

            var messages = new LinkedBlockingQueue<String>();
            WebSocket socket = client.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(10))
                    .buildAsync(URI.create("ws://localhost:" + port
                                    + "/gameSocket?roomCode=boot-smoke&participantName=Host"),
                            new WebSocket.Listener() {
                                private final StringBuilder buffer = new StringBuilder();

                                @Override
                                public CompletionStage<?> onText(WebSocket ws, CharSequence data, boolean last) {
                                    buffer.append(data);
                                    if (last) {
                                        messages.add(buffer.toString());
                                        buffer.setLength(0);
                                    }
                                    ws.request(1);
                                    return null;
                                }
                            }).get(10, TimeUnit.SECONDS);
            try {
                long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
                while (System.nanoTime() < deadline) {
                    String message = messages.poll(1, TimeUnit.SECONDS);
                    if (message != null && message.startsWith("{")) {
                        var json = new JsonMapper().readTree(message);
                        if ("voteUpdate".equals(json.path("type").asString())) {
                            assertFalse(json.path("cards").isEmpty());
                            return;
                        }
                    }
                }
                fail("No JSON room state received over WebSocket");
            } finally {
                socket.abort();
            }
        }
    }
}
