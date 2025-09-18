package com.example.estpoker.security;

import com.example.estpoker.config.PasswordProperties;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class PasswordHasher {

  private final BCryptPasswordEncoder encoder;
  private final String pepper;

  public PasswordHasher(PasswordProperties props) {
    int cost = Math.max(4, Math.min(31, props.getBcryptCost()));
    this.encoder = new BCryptPasswordEncoder(cost);
    this.pepper = props.getPepper() == null ? "" : props.getPepper();
  }

  /** Create a BCrypt hash. Null raw → empty string before peppering. */
  public String hash(String raw) {
    String input = (raw == null ? "" : raw) + pepper;
    return encoder.encode(input);
  }

  /** Verify raw against stored hash. */
  public boolean matches(String raw, String hash) {
    if (hash == null || hash.isBlank()) return false;
    String input = (raw == null ? "" : raw) + pepper;
    return encoder.matches(input, hash);
  }
}
