package com.example.estpoker.rooms.repo;

import com.example.estpoker.config.AppStorageProperties;
import org.apache.commons.net.ftp.FTPSClient;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FtpsRoomStoreJsonTest {
    @Test
    void loadsLegacyTimestampsAndPreservesSnapshotOnSaveAndReload() throws Exception {
        // Jackson 2 stored Instant values as decimal epoch seconds.
        var bytes = new AtomicReference<>("""
                {"code":"legacy","title":"Planning","createdAt":1700000000.123456789,
                 "updatedAt":1700000001.0,"passwordHash":"existing-hash",
                 "settings":{"sequenceId":"fib.scrum","autoRevealEnabled":true},
                 "history":[{"at":1700000000.5,"actor":"Host","action":"created"}]}
                """.getBytes(StandardCharsets.UTF_8));
        FTPSClient client = mock(FTPSClient.class);
        when(client.login(anyString(), anyString())).thenReturn(true);
        when(client.retrieveFile(eq("rooms/legacy.json"), any(OutputStream.class)))
                .thenAnswer(call -> {
                    call.<OutputStream>getArgument(1).write(bytes.get());
                    return true;
                });
        when(client.storeFile(eq("rooms/legacy.json"), any(InputStream.class)))
                .thenAnswer(call -> {
                    bytes.set(call.<InputStream>getArgument(1).readAllBytes());
                    return true;
                });
        var properties = new AppStorageProperties();
        properties.getFtps().setHost("localhost");
        properties.getFtps().setUser("test");
        properties.getFtps().setPass("test");
        var store = new FtpsRoomStore(properties, () -> client);

        var room = store.load("legacy").orElseThrow();
        assertEquals(Instant.ofEpochSecond(1700000000L, 123456789), room.getCreatedAt());
        assertEquals(1, room.getHistory().size());
        store.save(room);
        assertTrue(new JsonMapper().readTree(bytes.get()).path("createdAt").isNumber());
        var reloaded = store.load("legacy").orElseThrow();

        assertEquals(room.getCreatedAt(), reloaded.getCreatedAt());
        assertEquals("Planning", reloaded.getTitle());
        assertEquals("existing-hash", reloaded.getPasswordHash());
        assertEquals("fib.scrum", reloaded.getSettings().getSequenceId());
        assertTrue(reloaded.getSettings().isAutoRevealEnabled());
        assertEquals(1, reloaded.getHistory().size());
        assertEquals(Instant.ofEpochSecond(1700000000L, 500000000),
                reloaded.getHistory().getFirst().getAt());
        assertEquals("Host", reloaded.getHistory().getFirst().getActor());
    }
}
