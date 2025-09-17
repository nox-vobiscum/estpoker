package com.example.estpoker.web;

import com.example.estpoker.service.StorageDiagnosticsService;
import com.example.estpoker.service.StorageProbeService;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
public class StorageController {

  private final StorageDiagnosticsService diag;
  private final StorageProbeService probe;

  // constructor injection: initialize both finals
  public StorageController(StorageDiagnosticsService diag, StorageProbeService probe) {
    this.diag = diag;
    this.probe = probe;
  }

  // --- health (kept) --------------------------------------------------------
  @GetMapping("/api/storage/health")
  public Map<String, Object> health() {
    var h = diag.ping();
    return Map.of(
        "ok", h.isOk(),
        "mode", h.getMode(),
        "server", h.getServer(),
        "elapsedMs", h.getElapsedMs(),
        "message", h.getMessage()
    );
  }

  // --- probe: write ----------------------------------------------------------
  @PostMapping("/api/storage/probe/write")
  public Map<String, Object> probeWrite(
      @RequestParam(defaultValue = "probe.txt") String name,
      @RequestBody(required = false) String body
  ) throws Exception {
    String content = (body == null || body.isBlank())
        ? ("hello @ " + java.time.Instant.now())
        : body;

    probe.writeUtf8(name, content);

    return Map.of(
        "ok", true,
        "wrote", name,
        "bytes", content.getBytes(StandardCharsets.UTF_8).length
    );
  }

  // --- probe: read -----------------------------------------------------------
  @GetMapping("/api/storage/probe/read")
  public Map<String, Object> probeRead(
      @RequestParam(defaultValue = "probe.txt") String name
  ) throws Exception {
    String txt = probe.readUtf8(name);
    return Map.of(
        "ok", true,
        "read", name,
        "bytes", txt.length(),
        "preview", txt.substring(0, Math.min(80, txt.length()))
    );
  }
}
