package com.example.estpoker.persistence;

import com.example.estpoker.model.PersistentRoom;

import java.util.Optional;

/**
 * No-Op Implementierung. Tut so, als wäre nie ein Name vergeben,
 * speichert nichts und hält die DB damit komplett inaktiv.
 */
public class NoOpPersistentRooms implements PersistentRooms {

    @Override
    public boolean existsByNameIgnoreCase(String name) {
        return false;
    }

    @Override
    public Optional<PersistentRoom> findByNameIgnoreCase(String name) {
        return Optional.empty();
    }

    @Override
    public PersistentRoom save(PersistentRoom room) {
        return room; // nichts persistiert
    }
}
