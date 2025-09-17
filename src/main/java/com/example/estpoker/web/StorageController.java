package com.example.estpoker.web;

import com.example.estpoker.service.StorageDiagnosticsService;
import com.example.estpoker.service.StorageDiagnosticsService.StorageHealth;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Read-only storage diagnostics API. */
@RestController
@RequestMapping("/api/storage")
public class StorageController {

  private final StorageDiagnosticsService diag;

  public StorageController(StorageDiagnosticsService diag) {
    this.diag = diag;
  }

  @GetMapping("/health")
  public ResponseEntity<StorageHealth> health() {
    StorageHealth h = diag.ping();
    // 200 when ok, 503 when not ok → ideal for uptime monitors
    return ResponseEntity.status(h.isOk() ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(h);
  }
}
