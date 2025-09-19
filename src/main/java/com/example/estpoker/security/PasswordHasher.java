package com.example.estpoker.security;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class PasswordHasher {
  private final BCryptPasswordEncoder enc = new BCryptPasswordEncoder();

  public String hash(String raw) {
    return enc.encode(raw == null ? "" : raw);
  }
  public boolean matches(String raw, String hash) {
    if (hash == null || hash.isBlank()) return (raw == null || raw.isBlank());
    return enc.matches(raw == null ? "" : raw, hash);
  }
}
