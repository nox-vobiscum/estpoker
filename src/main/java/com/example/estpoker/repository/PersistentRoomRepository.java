package com.example.estpoker.repository;

import com.example.estpoker.model.PersistentRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface PersistentRoomRepository extends JpaRepository<PersistentRoom, String> {

    boolean existsByNameIgnoreCase(String name);

    Optional<PersistentRoom> findByNameIgnoreCase(String name);

    void deleteByLastActiveAtBefore(Instant cutoff);

    // Cleanup gezielt für Test-Räume
    void deleteByTestRoomIsTrueAndLastActiveAtBefore(Instant cutoff);

    long countByTestRoomIsTrue();
}
