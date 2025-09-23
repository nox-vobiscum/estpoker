package com.example.estpoker.controller;

import com.example.estpoker.persistence.PersistentRooms;
import com.example.estpoker.service.GameService;
import com.example.estpoker.model.Room;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class GameController {

    private final PersistentRooms persistentRooms;
    private final GameService gameService;

    @Value("${features.persistentRooms.enabled:false}")
    private boolean persistenceEnabled;

    public GameController(PersistentRooms persistentRooms, GameService gameService) {
        this.persistentRooms = persistentRooms;
        this.gameService = gameService;
    }

    @GetMapping("/")
    public String landingPage() {
        return "index";
    }

    /**
     * Minimal view route for the invitation page.
     * If a roomCode is provided via query param, pass it through to the view
     * so the hidden field and heading can render correctly.
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

        // Normalize incoming values
        final String pName = safeTrim(participantName);
        final String requestedRoomName = safeTrim(roomCode);

        // Basic validation → bounce back to landing page with message
        if (pName.isBlank() || requestedRoomName.isBlank()) {
            model.addAttribute("error", "Bitte Namen und Raum ausfüllen.");
            model.addAttribute("participantName", pName);
            model.addAttribute("roomCode", requestedRoomName);
            model.addAttribute("persistent", persistent);
            model.addAttribute("testRoom", testRoom);
            return "index";
        }

        String effectiveRoomCode = requestedRoomName;

        // If persistence feature is enabled AND user requested a persistent room:
        // only try to canonicalize the code via lookup. We do NOT create anything here.
        if (persistent && persistenceEnabled) {
            var canonical = persistentRooms.findByNameIgnoreCase(requestedRoomName);
            if (canonical.isPresent()) {
                // Use canonical/normalized code from persistence layer
                effectiveRoomCode = canonical.get();
            } else {
                // No DB record → keep requested name as-is
                effectiveRoomCode = requestedRoomName;
            }
        }

        // Prepare model for room.html
        model.addAttribute("participantName", pName);
        model.addAttribute("roomCode", effectiveRoomCode);

        // Card rows (rendered via th:each in the template)
        model.addAttribute("cardsRow1", new String[]{"1", "2", "3", "5"});
        model.addAttribute("cardsRow2", new String[]{"8", "13", "20", "40"});
        model.addAttribute("cardsRow3", new String[]{"❓", "💬", "☕"});

        // Redirect to GET /room with encoded params to support refresh/deep-linking
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

        // Missing room → back to landing
        if (rCode.isEmpty()) {
            model.addAttribute("error", "Missing room or participant");
            return "index";
        }

        // Deep-link without participant name → show invite page (lets user enter name)
        if (pName.isEmpty()) {
            model.addAttribute("roomCode", rCode);
            return "invite";
        }

        // --- Server-side safety net: if name already taken in target room, bounce to invite ---
        Room room = gameService.getRoom(rCode);
        if (room != null && room.nameInUse(pName)) {
            // Pass information back so the invite page (and/or its JS) can prompt for a unique name
            return "redirect:/invite?roomCode="
                    + org.springframework.web.util.UriUtils.encodeQueryParam(rCode, java.nio.charset.StandardCharsets.UTF_8)
                    + "&participantName="
                    + org.springframework.web.util.UriUtils.encodeQueryParam(pName, java.nio.charset.StandardCharsets.UTF_8)
                    + "&nameTaken=1";
        }

        // Both params present and name free → render the room directly
        model.addAttribute("participantName", pName);
        model.addAttribute("roomCode", rCode);

        // Same card rows as POST /join
        model.addAttribute("cardsRow1", new String[]{"1", "2", "3", "5"});
        model.addAttribute("cardsRow2", new String[]{"8", "13", "20", "40"});
        model.addAttribute("cardsRow3", new String[]{"❓", "💬", "☕"});

        return "room";
    }
}
