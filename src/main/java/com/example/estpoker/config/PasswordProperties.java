package com.example.estpoker.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.security.password")
public class PasswordProperties {
  /** BCrypt cost/strength (valid 4..31). */
  private int bcryptCost = 10;

  /** Optional global pepper appended to every password before hashing. */
  private String pepper = "";

  public int getBcryptCost() { return bcryptCost; }
  public void setBcryptCost(int bcryptCost) { this.bcryptCost = bcryptCost; }

  public String getPepper() { return pepper; }
  public void setPepper(String pepper) { this.pepper = pepper; }
}
