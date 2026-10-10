package com.example.planningpoker.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.List;
import java.io.IOException;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class GameServiceSendTest {
    @Test
    void closedConnectionsAreSkippedAndTransportErrorsRemainVisible() throws Exception {
        var service = new GameService();
        var session = mock(WebSocketSession.class);
        assertFalse(service.sendText(session, "pong"));
        verify(session, never()).sendMessage(any());
        when(session.isOpen()).thenReturn(true);
        doThrow(new IOException("disconnected")).when(session).sendMessage(any());
        assertThrows(IOException.class, () -> service.sendText(session, "pong"));
    }

    @Test
    void busyConnectionDoesNotBlockAnotherConnection() throws Exception {
        var service = new GameService();
        var busy = mock(WebSocketSession.class);
        var other = mock(WebSocketSession.class);
        when(busy.isOpen()).thenReturn(true);
        when(other.isOpen()).thenReturn(true);
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        doAnswer(invocation -> {
            entered.countDown();
            assertTrue(release.await(5, TimeUnit.SECONDS));
            return null;
        }).when(busy).sendMessage(any());
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> service.sendText(busy, "first"));
            try {
                assertTrue(entered.await(5, TimeUnit.SECONDS));
                assertTrue(executor.submit(() -> service.sendText(other, "pong")).get(2, TimeUnit.SECONDS));
            } finally {
                release.countDown();
            }
            assertTrue(first.get(5, TimeUnit.SECONDS));
        }
        verify(other).sendMessage(new TextMessage("pong"));
    }

    @Test
    void identityAndBroadcastNeverWriteConcurrentlyToTheSameSession() throws Exception {
        var service = new GameService();
        var session = mock(WebSocketSession.class);
        var room = service.getOrCreateRoom("send-test");
        service.addSession(session, room);
        when(session.isOpen()).thenReturn(true);
        var firstWriting = new CountDownLatch(1);
        var releaseFirst = new CountDownLatch(1);
        var secondStarted = new CountDownLatch(1);
        var secondFinished = new CountDownLatch(1);
        var active = new AtomicInteger();
        var peak = new AtomicInteger();
        List<String> messages = new CopyOnWriteArrayList<>();
        doAnswer(invocation -> {
            int writers = active.incrementAndGet();
            peak.accumulateAndGet(writers, Math::max);
            try {
                TextMessage message = invocation.getArgument(0);
                messages.add(message.getPayload());
                if (message.getPayload().contains("\"you\"")) {
                    firstWriting.countDown();
                    assertTrue(releaseFirst.await(5, TimeUnit.SECONDS));
                }
            } finally {
                active.decrementAndGet();
            }
            return null;
        }).when(session).sendMessage(any(TextMessage.class));

        try (var executor = Executors.newFixedThreadPool(2)) {
            var identity = executor.submit(() -> service.sendIdentity(session, "Host", "stable-cid"));
            assertTrue(firstWriting.await(5, TimeUnit.SECONDS));
            var broadcast = executor.submit(() -> {
                secondStarted.countDown();
                try { service.broadcastToRoom(room, "participantJoined:Guest"); }
                finally { secondFinished.countDown(); }
            });
            try {
                assertTrue(secondStarted.await(5, TimeUnit.SECONDS));
                assertFalse(secondFinished.await(200, TimeUnit.MILLISECONDS),
                        "Broadcast must wait while identity occupies the transport");
            } finally {
                releaseFirst.countDown();
            }
            identity.get(5, TimeUnit.SECONDS);
            broadcast.get(5, TimeUnit.SECONDS);
        }
        assertEquals(1, peak.get());
        assertEquals(2, messages.size());
        assertTrue(messages.getFirst().contains("stable-cid"));
        assertEquals("participantJoined:Guest", messages.getLast());
    }
}
