package com.example.estpoker.persistence;

import com.example.estpoker.model.PersistentRoom;
import com.example.estpoker.repository.PersistentRoomRepository;

import java.util.Optional;

/**
 * Adapter auf JPA-Repository. Nur aktiv, wenn features.persistentRooms.enabled=true.
 */
public class JpaPersistentRooms implements PersistentRooms {

    private final PersistentRoomRepository repo;

    public JpaPersistentRooms(PersistentRoomRepository repo) {
        this.repo = repo;
    }

    @Override
    public boolean existsByNameIgnoreCase(String name) {
        if (name == null) return false;
        String n = name.trim();
        if (n.isEmpty()) return false;
        return repo.existsByNameIgnoreCase(n);
    }

    @Override
    public Optional<PersistentRoom> findByNameIgnoreCase(String name) {
        if (name == null) return Optional.empty();
        String n = name.trim();
        if (n.isEmpty()) return Optional.empty();
        return repo.findByNameIgnoreCase(n);
    }

    @Override
    public PersistentRoom save(PersistentRoom room) {
        return repo.save(room);
    }
}
