package com.example.estpoker.controller;

import com.example.estpoker.model.PersistentRoom;
import com.example.estpoker.persistence.PersistentRooms;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.time.Instant;
import java.util.Optional;

@Controller
public class GameController {

    private final PersistentRooms persistentRooms;

    @Value("${features.persistentRooms.enabled:false}")
    private boolean persistenceEnabled;

    public GameController(PersistentRooms persistentRooms) {
        this.persistentRooms = persistentRooms;
    }

    @GetMapping("/")
    public String landingPage() {
        return "index";
    }

    /**
     * Minimal view route for the invitation page.
     * Keeps behavior unchanged elsewhere; if a roomCode is provided via query param,
     * pass it to the view so the hidden field and heading work.
     */
    @GetMapping("/invite")
    public String invite(
            @RequestParam(name = "roomCode", required = false) String roomCode,
            Model model) {
        String rCode = safeTrim(roomCode);
        if (!rCode.isEmpty()) {
            model.addAttribute("roomCode", rCode);
        }
        return "invite";
    }

    @PostMapping("/join")
    public String joinRoom(@RequestParam String participantName,
                           @RequestParam String roomCode,
                           @RequestParam(required = false, defaultValue = "false") boolean persistent,
                           @RequestParam(required = false, defaultValue = "false") boolean testRoom,
                           Model model) {

        // Trim and keep variables effectively final
        final String pName = safeTrim(participantName);
        final String requestedRoomName = safeTrim(roomCode);

        if (pName.isBlank() || requestedRoomName.isBlank()) {
            model.addAttribute("error", "Bitte Namen und Raum ausfüllen.");
            model.addAttribute("participantName", pName);
            model.addAttribute("roomCode", requestedRoomName);
            model.addAttribute("persistent", persistent);
            model.addAttribute("testRoom", testRoom);
            return "index";
        }

        String effectiveRoomCode = requestedRoomName;

        // Persistent rooms only if feature flag enabled AND checkbox set
        if (persistent && persistenceEnabled) {
            Optional<PersistentRoom> existing = persistentRooms.findByNameIgnoreCase(requestedRoomName);
            PersistentRoom pr = existing.orElseGet(() -> {
                // Public constructor with name – @PrePersist sets id/createdAt/lastActiveAt
                PersistentRoom r = new PersistentRoom(requestedRoomName);
                r.setTestRoom(testRoom);
                r.setLastActiveAt(Instant.now());
                return r;
            });
            pr = persistentRooms.save(pr);
            effectiveRoomCode = pr.getId();
        }

        // Model for room.html
        model.addAttribute("participantName", pName);
        model.addAttribute("roomCode", effectiveRoomCode);

        // Card rows (rendered via th:each)
        model.addAttribute("cardsRow1", new String[]{"1", "2", "3", "5"});
        model.addAttribute("cardsRow2", new String[]{"8", "13", "20", "40"});
        model.addAttribute("cardsRow3", new String[]{"❓", "💬", "☕"});

        return "redirect:/room?roomCode=" + org.springframework.web.util.UriUtils.encodeQueryParam(effectiveRoomCode, java.nio.charset.StandardCharsets.UTF_8)
                + "&participantName=" + org.springframework.web.util.UriUtils.encodeQueryParam(pName, java.nio.charset.StandardCharsets.UTF_8);
    }

    // --- helpers ---
    private static String safeTrim(String s) {
        return (s == null) ? "" : s.trim();
    }

    @GetMapping("/room")
    public String getRoom(
            @RequestParam(name = "roomCode", required = false) String roomCode,
            @RequestParam(name = "participantName", required = false) String participantName,
            Model model) {

        String rCode = safeTrim(roomCode);
        String pName = safeTrim(participantName);

        // No room → back to landing
        if (rCode.isEmpty()) {
            model.addAttribute("error", "Missing room or participant");
            return "index";
        }

        // Deep-link without participantName → show invite page
        if (pName.isEmpty()) {
            model.addAttribute("roomCode", rCode);
            return "invite";
        }

        // With both params → go straight to the room
        model.addAttribute("participantName", pName);
        model.addAttribute("roomCode", rCode);

        // Same card rows as POST /join
        model.addAttribute("cardsRow1", new String[]{"1", "2", "3", "5"});
        model.addAttribute("cardsRow2", new String[]{"8", "13", "20", "40"});
        model.addAttribute("cardsRow3", new String[]{"❓", "💬", "☕"});

        return "room";
    }
}
