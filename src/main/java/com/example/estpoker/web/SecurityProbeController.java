package com.example.estpoker.web;

import com.example.estpoker.security.PasswordHasher;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/security")
@ConditionalOnProperty(name = "features.securityProbe.enabled", havingValue = "true")
public class SecurityProbeController {

  private final PasswordHasher hasher;

  public SecurityProbeController(PasswordHasher hasher) {
    this.hasher = hasher;
  }

  @GetMapping("/hash")
  public Map<String, String> hash(@RequestParam String pw) {
    return Map.of("hash", hasher.hash(pw));
  }

  @GetMapping("/verify")
  public Map<String, Boolean> verify(@RequestParam String pw, @RequestParam String hash) {
    return Map.of("ok", hasher.matches(pw, hash));
  }
}
