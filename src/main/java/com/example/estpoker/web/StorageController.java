package com.example.estpoker.web;

import com.example.estpoker.service.StorageDiagnosticsService;
import com.example.estpoker.service.StorageDiagnosticsService.Status;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Health endpoint for the file storage.
 */
@RestController
@RequestMapping("/api/storage")
@ConditionalOnProperty(name = "app.storage.mode", havingValue = "ftps")
public class StorageController {

  private final StorageDiagnosticsService diag;

  public StorageController(StorageDiagnosticsService diag) {
    this.diag = diag;
  }

  @GetMapping("/health")
  public ResponseEntity<Status> health() {
    Status s = diag.ping();
    return new ResponseEntity<>(s, s.ok() ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
  }
}
