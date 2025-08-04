package com.example.estpoker.data;

import com.example.estpoker.model.ParticipantEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ParticipantEntityRepository extends JpaRepository<ParticipantEntity, Long> {
}
