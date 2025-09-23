package com.example.estpoker.model;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class RoomTest {

    @Test
    void ensureUniqueName_handlesExistingAndNumericSuffix() {
        Room r = new Room("X");
        r.addParticipant(new Participant("Roland"));
        r.addParticipant(new Participant("Roland (2)"));

        // "Roland" is taken, "(2)" also taken -> should suggest "(3)"
        assertEquals("Roland (3)", r.ensureUniqueName("Roland"));

        // Null/blank -> default
        assertEquals("Guest", r.ensureUniqueName(null));
        assertEquals("Guest", r.ensureUniqueName("  "));
    }

    @Test
    void renameParticipant_suffixWhenTargetExists_preservesState_andCidMapping() {
        Room r = new Room("X");

        Participant alice = new Participant("Alice");
        alice.setActive(true);
        alice.setParticipating(true);
        alice.setVote("5");

        Participant bob = new Participant("Bob"); // target name already exists
        bob.setActive(true);
        bob.setParticipating(true);
        // Bob has no vote yet (keeps test simple)

        r.addParticipant(alice);
        r.addParticipant(bob);

        // Link a CID to Alice so we can verify CID->name remapping after rename
        r.linkCid("tab-1", "Alice");

        // Request rename "Alice" -> "Bob": since "Bob" exists, we must suffix to keep uniqueness.
        String finalName = r.renameParticipant("Alice", "Bob");
        assertEquals("Bob (2)", finalName, "Should NOT merge into existing Bob; unique suffix must be created");

        // We must now have exactly one "Bob" and exactly one "Bob (2)"
        List<Participant> all = r.getParticipants();
        long bobCount = all.stream().filter(p -> "Bob".equals(p.getName())).count();
        long bob2Count = all.stream().filter(p -> "Bob (2)".equals(p.getName())).count();
        assertEquals(1, bobCount, "Original Bob must remain intact");
        assertEquals(1, bob2Count, "Renamed participant must take unique suffixed name");

        Participant bob2 = all.stream()
                .filter(p -> "Bob (2)".equals(p.getName()))
                .findFirst().orElseThrow();

        // Alice's vote/state should now live on the suffixed participant, not on original Bob
        assertEquals("5", bob2.getVote());
        assertTrue(bob2.isActive());
        assertTrue(bob2.isParticipating());

        Participant onlyBob = all.stream()
                .filter(p -> "Bob".equals(p.getName()))
                .findFirst().orElseThrow();
        assertNull(onlyBob.getVote(), "Existing Bob should keep his own state (no merge)");

        // CID mapping must now resolve to the new unique name
        Optional<Participant> byCid = r.getParticipantByCid("tab-1");
        assertTrue(byCid.isPresent(), "CID must still resolve after rename");
        assertEquals("Bob (2)", byCid.get().getName(), "CID must point to the renamed participant");
    }

    @Test
    void assignNewHostIfNecessary_promotesActiveParticipant() {
        Room r = new Room("X");

        Participant a = new Participant("Alice");
        a.setActive(true);
        a.setParticipating(true);

        Participant b = new Participant("Bob");
        b.setActive(true);
        b.setParticipating(false);

        r.addParticipant(a);
        r.addParticipant(b);

        // No host yet -> should promote (prefer active + participating)
        String host = r.assignNewHostIfNecessary(null);
        assertNotNull(host);

        Participant hostP = r.getHost();
        assertNotNull(hostP);
        assertTrue(hostP.isHost());
        assertEquals("Alice", hostP.getName());
    }
}
