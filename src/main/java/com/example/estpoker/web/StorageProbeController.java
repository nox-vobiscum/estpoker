package com.example.estpoker.web;

import com.example.estpoker.storage.FileStorage;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/storage")
public class StorageProbeController {

  private final FileStorage storage;

  public StorageProbeController(FileStorage storage) {
    this.storage = storage;
  }

  /** GET /api/storage/health  → { ok:true, files:[...]} */
  @GetMapping("/health")
  public Map<String,Object> health() throws Exception {
    var files = storage.list(".");
    var res = new HashMap<String,Object>();
    res.put("ok", true);
    res.put("files", files);
    return res;
  }

  /** POST /api/storage/put-demo  → writes data/rooms/demo-<ts>.json */
  @PostMapping(value="/put-demo", produces= MediaType.APPLICATION_JSON_VALUE)
  public Map<String,Object> putDemo() throws Exception {
    var ts = Instant.now().toString().replace(':','-');
    var name = "demo-" + ts + ".json";
    var json = ("{\"hello\":\"world\",\"ts\":\"" + ts + "\"}")
        .getBytes(StandardCharsets.UTF_8);

    storage.putBytes(name, json);

    var res = new HashMap<String,Object>();
    res.put("ok", true);
    res.put("written", name);
    res.put("ls", storage.list("."));
    return res;
  }
}
