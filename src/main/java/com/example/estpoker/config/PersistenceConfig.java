package com.example.estpoker.config;

import com.example.estpoker.persistence.JpaPersistentRooms;
import com.example.estpoker.persistence.NoOpPersistentRooms;
import com.example.estpoker.persistence.PersistentRooms;
import com.example.estpoker.repository.PersistentRoomRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wählt je nach Feature-Flag die passende Implementierung des Ports aus.
 */
@Configuration
public class PersistenceConfig {

    @Bean
    @ConditionalOnProperty(name = "features.persistentRooms.enabled", havingValue = "true")
    public PersistentRooms persistentRoomsJpa(PersistentRoomRepository repo) {
        return new JpaPersistentRooms(repo);
    }

    @Bean
    @ConditionalOnProperty(name = "features.persistentRooms.enabled", havingValue = "false", matchIfMissing = true)
    public PersistentRooms persistentRoomsNoOp() {
        return new NoOpPersistentRooms();
    }
}
