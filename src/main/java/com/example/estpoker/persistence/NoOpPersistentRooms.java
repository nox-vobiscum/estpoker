package com.example.estpoker.persistence;

import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * No-op adapter for deployments without DB persistence.
 */
@Component
public class NoOpPersistentRooms implements PersistentRooms {

    @Override
    public boolean exists(String code) {
        // No DB -> we claim nothing exists
        return false;
    }

    @Override
    public Optional<String> findByNameIgnoreCase(String code) {
        // No DB lookup available
        return Optional.empty();
    }
}
