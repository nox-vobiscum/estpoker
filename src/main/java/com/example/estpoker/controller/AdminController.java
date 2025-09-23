package com.example.estpoker.controller;

import com.example.estpoker.model.Ping;
import com.example.estpoker.repository.PingRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Admin endpoints that work with or without a DB.
 * - If a PingRepository bean exists, we use it.
 * - If not, endpoints respond gracefully instead of crashing the app.
 */
@RestController
@RequestMapping("/admin")
public class AdminController {

    private final ObjectProvider<PingRepository> pingRepoProvider;

    /** Feature flag only for info; DB availability is decided by the presence of a repository bean. */
    @Value("${features.persistentRooms.enabled:false}")
    private boolean persistenceEnabled;

    public AdminController(ObjectProvider<PingRepository> pingRepoProvider) {
        this.pingRepoProvider = pingRepoProvider;
    }

    /** Lightweight health endpoint that never crashes. */
    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("app", "ok");
        out.put("persistentRooms", persistenceEnabled ? "enabled" : "disabled");

        PingRepository repo = pingRepoProvider.getIfAvailable();
        if (repo == null) {
            out.put("db", "disabled");
            return out;
        }

        try {
            long count = repo.count(); // just to touch the DB if present
            out.put("db", "ok");
            out.put("dbCount", count);
        } catch (Exception e) {
            out.put("db", "error");
            out.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
        }
        return out;
    }

    /** Test: create a Ping row if a repository/DB is available. */
    @PostMapping("/ping")
    public ResponseEntity<String> createPing() {
        PingRepository repo = pingRepoProvider.getIfAvailable();

        if (repo == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("DB repository not available in this profile (no JPA).");
        }

        try {
            Ping p = new Ping();
            repo.save(p);
            return ResponseEntity.ok("✅ New Ping persisted.");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("❌ Error persisting Ping: " + e.getMessage());
        }
    }
}
