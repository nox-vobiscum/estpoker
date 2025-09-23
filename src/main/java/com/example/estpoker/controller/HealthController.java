package com.example.estpoker.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class HealthController {

  @Value("${spring.profiles.active:default}")
  private String activeProfile;

  @Value("${features.persistentRooms.enabled:false}")
  private boolean persistentRoomsEnabled;

  /** Fast, DB-freier Liveness/Readiness Check (für Koyeb) */
  @GetMapping("/healthz")
  public String healthz() {
    return "ok";
  }

  /** Menschlich lesbarer Health/Status ohne DB */
  @GetMapping("/admin/health")
  public Map<String, Object> adminHealth() {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("app", "ok");
    m.put("profile", activeProfile);
    m.put("persistentRooms", persistentRoomsEnabled ? "enabled" : "disabled");
    m.put("db", "disabled"); // explizit: keine DB
    return m;
  }
}
