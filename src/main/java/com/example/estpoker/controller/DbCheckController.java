package com.example.estpoker.controller;

import com.example.estpoker.data.ParticipantEntityRepository;
import com.example.estpoker.model.ParticipantEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
public class DbCheckController {

    private final ParticipantEntityRepository participantRepo;

    @Value("${features.persistentRooms.enabled:false}")
    private boolean persistenceEnabled;

    public DbCheckController(ParticipantEntityRepository participantRepo) {
        this.participantRepo = participantRepo;
    }

    @GetMapping("/dbcheck")
    public String checkDb() {
        if (!persistenceEnabled) {
            return "ℹ️ DB persistence disabled (persistentRooms.enabled=false)";
        }
        // Teilnehmer speichern
        String name = "Test-" + Instant.now().toEpochMilli();
        participantRepo.save(new ParticipantEntity(name));

        // Teilnehmer zählen
        long count = participantRepo.count();

        return "✅ DB funktioniert! Teilnehmeranzahl: " + count;
    }
}
