package com.example.estpoker.repository;

import com.example.estpoker.model.PersistentRoom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PersistentRoomRepository extends JpaRepository<PersistentRoom, Long> {
    boolean existsByNameIgnoreCase(String name);
    Optional<PersistentRoom> findByRoomId(String roomId);
}
