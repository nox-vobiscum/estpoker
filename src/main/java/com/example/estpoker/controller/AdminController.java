package com.example.estpoker.controller;

import com.example.estpoker.model.Ping;
import com.example.estpoker.repository.PingRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin")
public class AdminController {

    private final PingRepository pingRepository;

    public AdminController(PingRepository pingRepository) {
        this.pingRepository = pingRepository;
    }

    // Prüft die Verbindung zur Datenbank
    @GetMapping("/ping")
    public ResponseEntity<String> pingDatabase() {
        try {
            long count = pingRepository.count();
            return ResponseEntity.ok("✅ DB-Verbindung erfolgreich – Anzahl Einträge: " + count);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("❌ DB-Verbindung fehlgeschlagen: " + e.getMessage());
        }
    }

    // Legt testweise einen neuen Ping-Eintrag an
    @PostMapping("/ping")
    public ResponseEntity<String> createPing() {
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
