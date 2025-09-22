package com.example.estpoker.rooms.service;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.rooms.model.StoredRoom;
import com.example.estpoker.rooms.repo.RoomStore;
import com.example.estpoker.security.PasswordHasher;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StoredRoomPersistenceServiceTest {

    private StoredRoomPersistenceService svcWith(RoomStore store) {
        return new StoredRoomPersistenceService(store, new PasswordHasher());
    }

    private Room sampleLive(String code) {
        Room r = new Room(code);
        r.setSequenceId("fibonacci");
        r.setAutoRevealEnabled(true);
        r.setAllowSpecials(false);
        r.setTopicVisible(true);
        r.setTopicLabel("Sprint 42");
        r.setTopicUrl("https://example.test/ticket/42");

        Participant alice = new Participant("Alice");
        alice.setHost(true);
        alice.setParticipating(true);
        alice.setActive(true);
        alice.setVote("8");

        Participant bob = new Participant("Bob");
        bob.setHost(false);
        bob.setParticipating(true);
        bob.setActive(true);
        bob.setVote("5");

        r.addParticipant(alice);
        r.addParticipant(bob);
        return r;
    }

    @Test
    void saveFromLive_creates_whenAbsent() throws Exception {
        RoomStore store = mock(RoomStore.class);
        when(store.load("X")).thenReturn(Optional.empty());

        StoredRoomPersistenceService svc = svcWith(store);
        Room live = sampleLive("X");

        svc.saveFromLive(live, "tester");

        ArgumentCaptor<StoredRoom> cap = ArgumentCaptor.forClass(StoredRoom.class);
        verify(store).save(cap.capture());
        StoredRoom saved = cap.getValue();

        assertEquals("X", saved.getCode());
        assertEquals("fibonacci", saved.getSettings().getSequenceId());
        assertTrue(saved.getSettings().isAutoRevealEnabled());
        assertFalse(saved.getSettings().isAllowSpecials());
        assertTrue(saved.getSettings().isTopicVisible());
        assertEquals("Sprint 42", saved.getTopicLabel());
        assertEquals("https://example.test/ticket/42", saved.getTopicUrl());
        assertNotNull(saved.getUpdatedAt());
        assertEquals(2, saved.getParticipants() == null ? 0 : saved.getParticipants().size());
    }

    @Test
    void saveFromLive_merges_whenExisting_preservesPassword() throws Exception {
        RoomStore store = mock(RoomStore.class);

        StoredRoom existing = StoredRoom.newWithCode("Y");
        existing.setPasswordHash("$2a$10$existingHashValue"); // pretend an existing bcrypt hash
        existing.getSettings().setSequenceId("old-seq");
        existing.setTopicLabel("old topic");
        existing.setTopicUrl("https://old");
        existing.setParticipants(List.of()); // old participants
        existing.touchCreatedIfNull();
        existing.touchUpdated();
        Instant prevUpdated = existing.getUpdatedAt();

        when(store.load("Y")).thenReturn(Optional.of(existing));

        StoredRoomPersistenceService svc = svcWith(store);
        Room live = sampleLive("Y");

        svc.saveFromLive(live, "tester");

        ArgumentCaptor<StoredRoom> cap = ArgumentCaptor.forClass(StoredRoom.class);
        verify(store).save(cap.capture());
        StoredRoom saved = cap.getValue();

        // Password must remain untouched
        assertEquals(existing.getPasswordHash(), saved.getPasswordHash());

        // New content must be applied
        assertEquals("fibonacci", saved.getSettings().getSequenceId());
        assertEquals("Sprint 42", saved.getTopicLabel());
        assertEquals("https://example.test/ticket/42", saved.getTopicUrl());
        assertEquals(2, saved.getParticipants().size());

        // Updated timestamp should move forward
        assertNotNull(saved.getUpdatedAt());
        assertTrue(saved.getUpdatedAt().isAfter(prevUpdated));
    }

    @Test
    void setPassword_and_verifyPassword_works() throws Exception {
        RoomStore store = mock(RoomStore.class);
        when(store.load("Z")).thenReturn(Optional.empty()); // first call in setPassword

        StoredRoomPersistenceService svc = svcWith(store);

        // Set password
        svc.setPassword("Z", "secret123");

        // Capture saved room with hash
        ArgumentCaptor<StoredRoom> cap = ArgumentCaptor.forClass(StoredRoom.class);
        verify(store).save(cap.capture());
        StoredRoom savedWithPwd = cap.getValue();
        assertNotNull(savedWithPwd.getPasswordHash());
        assertFalse(savedWithPwd.getPasswordHash().isBlank());

        // Next verifyPassword() call should read that saved room
        when(store.load("Z")).thenReturn(Optional.of(savedWithPwd));
        assertTrue(svc.verifyPassword("Z", "secret123"));
        assertFalse(svc.verifyPassword("Z", "wrong"));

        // Clear password and verify that blank works
        reset(store);
        when(store.load("Z")).thenReturn(Optional.of(savedWithPwd));
        doAnswer(inv -> {
            StoredRoom sr = inv.getArgument(0);
            // simulate persistence layer updating the stored entity
            savedWithPwd.setPasswordHash(sr.getPasswordHash());
            return null;
        }).when(store).save(any(StoredRoom.class));

        svc.setPassword("Z", null); // clear
        assertNull(savedWithPwd.getPasswordHash());

        when(store.load("Z")).thenReturn(Optional.of(savedWithPwd));
        assertTrue(svc.verifyPassword("Z", null));
        assertTrue(svc.verifyPassword("Z", "")); // blank allowed when no password set
    }
}
