package com.example.estpoker.rooms.web;

import com.example.estpoker.rooms.model.StoredRoom;
import com.example.estpoker.rooms.repo.RoomStore;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/rooms")
public class NameAvailabilityController {

  private final RoomStore store;

  public NameAvailabilityController(RoomStore store) {
    this.store = store;
  }

  @GetMapping("/{code}/name-available")
  public Map<String, Object> nameAvailable(
      @PathVariable String code,
      @RequestParam String name
  ) {
    final String c = safe(code);
    final String n = safe(name);

    boolean available = true;
    String suggestion = n;

    try {
      Optional<StoredRoom> opt = store.load(c);
      if (opt.isPresent()) {
        // collect existing names (lowercased) from the snapshot
        Set<String> taken = opt.get().getParticipants().stream()
            .map(sp -> norm(sp.getName()))
            .collect(Collectors.toSet());

        available = !taken.contains(norm(n));
        if (!available) {
          String root = stripNumericSuffix(n);
          suggestion = nextFree(root, taken);
        }
      }
    } catch (Exception ignore) {
      // best-effort: if snapshot not reachable, do not block joining
      available = true;
      suggestion = n;
    }

    Map<String, Object> out = new HashMap<>();
    out.put("available", available);
    out.put("suggestion", suggestion);
    return out;
  }

  private static String safe(String s) { return (s == null) ? "" : s.trim(); }
  private static String norm(String s) { return safe(s).toLowerCase(Locale.ROOT); }

  /** "Roland (2)" -> "Roland" (if it really is a numeric suffix) */
  private static String stripNumericSuffix(String s) {
    String t = safe(s);
    int len = t.length();
    if (len < 4 || t.charAt(len - 1) != ')') return t;
    int open = t.lastIndexOf(" (");
    if (open < 0) return t;
    String inside = t.substring(open + 2, len - 1);
    if (inside.isEmpty()) return t;
    for (int i = 0; i < inside.length(); i++) {
      if (!Character.isDigit(inside.charAt(i))) return t;
    }
    return t.substring(0, open);
  }

  private static String nextFree(String root, Set<String> takenLower) {
    String base = safe(root);
    if (!takenLower.contains(norm(base))) return base;
    for (int i = 2; i <= 999; i++) {
      String cand = base + " (" + i + ")";
      if (!takenLower.contains(norm(cand))) return cand;
    }
    return base + " (uniq)";
  }
}
