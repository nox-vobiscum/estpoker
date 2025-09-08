package com.example.estpoker.service;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Very small smoke tests to prove the test setup runs:
 * - join() creates room/participant
 * - first join becomes host
 * - re-join with same CID keeps the same logical person (name sticks)
 *
 * NOTE: This uses only methods that exist in your current GameService.
 *       No rename/collision logic yet – that can be tested once implemented.
 */
public class GameServiceNameTests {

    @Test
    @DisplayName("Smoke: first join creates participant and promotes to host")
    void joinCreatesParticipantAndHost() {
        GameService svc = new GameService();

        Room room = svc.join("r1", "cidA", "Alice");
        assertNotNull(room, "room should be created");
        assertNotNull(room.getParticipant("Alice"), "participant Alice should exist");
        assertNotNull(room.getHost(), "host should be set");
        assertEquals("Alice", room.getHost().getName(), "first join becomes host");
    }

    @Test
    @DisplayName("Smoke: re-join with same CID keeps same logical person (name sticks)")
    void rejoinWithSameCidKeepsIdentity() {
        GameService svc = new GameService();

        svc.join("r1", "cidA", "Alice");
        Room room = svc.join("r1", "cidA", "AliceChanged");

        Participant alice = room.getParticipant("Alice");
        assertNotNull(alice, "original 'Alice' should still be present");
        assertEquals("Alice", alice.getName(), "CID maps to original name – not renamed on re-join");
        assertNull(room.getParticipant("AliceChanged"), "no second row created just by changing name on same CID");
    }
}
