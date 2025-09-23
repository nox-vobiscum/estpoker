package com.example.estpoker.controller;

import com.example.estpoker.model.Ping;
import com.example.estpoker.repository.PingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/admin")
public class AdminController {

    private static final Logger log = LoggerFactory.getLogger(AdminController.class);

    /** Optional: may be absent in prod (FTPS-only). */
    private final ObjectProvider<PingRepository> pingRepositoryProvider;

    @Value("${features.persistentRooms.enabled:false}")
    private boolean persistenceEnabled;

    public AdminController(ObjectProvider<PingRepository> pingRepositoryProvider) {
        this.pingRepositoryProvider = pingRepositoryProvider;
    }

    /** Lightweight health for ops without Actuator. */
    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> out = new HashMap<>();
        out.put("app", "ok");
        out.put("profile", System.getProperty("spring.profiles.active", "default"));
        out.put("persistentRooms", persistenceEnabled ? "enabled" : "disabled");

        PingRepository repo = pingRepositoryProvider.getIfAvailable();
        if (repo == null) {
            out.put("db", "disabled");
        } else {
            try {
                long count = repo.count();
                out.put("db", "ok");
                out.put("dbCount", count);
            } catch (Exception e) {
                out.put("db", "error");
                out.put("dbError", e.getClass().getSimpleName() + ": " + e.getMessage());
            }
        }
        return out;
    }

    /** Write a test row – only when a DB/PingRepository exists. */
    @PostMapping("/ping")
    public ResponseEntity<String> createPing() {
        PingRepository repo = pingRepositoryProvider.getIfAvailable();
        if (repo == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body("DB repository not available (no PingRepository bean).");
        }
        try {
            Ping p = new Ping();
            repo.save(p);
            return ResponseEntity.ok("New Ping persisted.");
        } catch (Exception e) {
            log.warn("Ping save failed: {}", e.toString());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error persisting Ping: " + e.getMessage());
        }
    }
}
