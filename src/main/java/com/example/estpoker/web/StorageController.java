package com.example.estpoker.web;

import com.example.estpoker.config.AppStorageProperties;
import com.example.estpoker.service.StorageDiagnosticsService;
import com.example.estpoker.service.StorageProbeService;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class StorageController {

  private final StorageDiagnosticsService diag;
  private final StorageProbeService probe;
  private final AppStorageProperties props;

  public StorageController(StorageDiagnosticsService diag,
                           StorageProbeService probe,
                           AppStorageProperties props) {
    this.diag = diag;
    this.probe = probe;
    this.props = props;
  }

  // --- health (null-safe) ---------------------------------------------------
  @GetMapping("/api/storage/health")
  public Map<String, Object> health() {
    var h = diag.ping();
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", h.isOk());
    out.put("mode", h.getMode());
    out.put("server", h.getServer());     // may be null -> allowed
    out.put("elapsedMs", h.getElapsedMs());
    out.put("message", h.getMessage());   // may be null -> allowed
    return out;
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

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", true);
    out.put("wrote", name);
    out.put("bytes", content.getBytes(StandardCharsets.UTF_8).length);
    return out;
  }

  // --- probe: read -----------------------------------------------------------
  @GetMapping("/api/storage/probe/read")
  public Map<String, Object> probeRead(
      @RequestParam(defaultValue = "probe.txt") String name
  ) throws Exception {
    String txt = probe.readUtf8(name);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", true);
    out.put("read", name);
    out.put("bytes", txt.getBytes(StandardCharsets.UTF_8).length);
    out.put("preview", txt.substring(0, Math.min(120, txt.length())));
    return out;
  }

  // --- debug: sanitized config (nur temporär nutzen) ------------------------
  @GetMapping("/api/storage/debug-config")
  public Map<String, Object> debugConfig() {
    var f = props.getFtps();
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("mode", props.getMode());
    out.put("host", f != null ? String.valueOf(f.getHost()) : null);
    out.put("port", f != null ? f.getPort() : null);
    out.put("baseDir", f != null ? String.valueOf(f.getBaseDir()) : null);
    out.put("hasUser", f != null && f.getUser() != null && !f.getUser().isBlank());
    out.put("hasPass", f != null && f.getPass() != null && !f.getPass().isBlank());
    return out;
  }
}
