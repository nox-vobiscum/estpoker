package com.example.estpoker.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

@RestController
@RequestMapping("/health")
public class HealthCheckController {

    private final DataSource dataSource;

    @Value("${features.persistentRooms.enabled:false}")
    private boolean persistenceEnabled;

    public HealthCheckController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping("/db")
    public ResponseEntity<String> checkDatabaseConnection() {
        // Wenn Persistenz deaktiviert ist, DB nicht aufwecken
        if (!persistenceEnabled) {
            return ResponseEntity.status(HttpStatus.NO_CONTENT)
                    .body("DB check disabled (persistentRooms.enabled=false)");
        }
        try (Connection conn = dataSource.getConnection()) {
            if (conn.isValid(2)) {
                return ResponseEntity.ok("DB OK");
            } else {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body("DB NOT OK");
            }
        } catch (SQLException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("DB ERROR: " + e.getMessage());
        }
    }
}
