package com.example.estpoker.controller;

import com.example.estpoker.model.Ping;
import com.example.estpoker.repository.PingRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin")
public class AdminController {

    private final PingRepository pingRepository;

    @Value("${features.persistentRooms.enabled:false}")
    private boolean persistenceEnabled;

    public AdminController(PingRepository pingRepository) {
        this.pingRepository = pingRepository;
    }

    // Legt testweise einen neuen Ping-Eintrag an
    @PostMapping("/ping")
    public ResponseEntity<String> createPing() {
        if (!persistenceEnabled) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("DB persistence disabled (persistentRooms.enabled=false)");
        }
        try {
            Ping p = new Ping();
            pingRepository.save(p);
            return ResponseEntity.ok("✅ Neuer Ping wurde gespeichert!");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("❌ Fehler beim Speichern: " + e.getMessage());
        }
    }
}
