package com.example.estpoker.controller;

import com.example.estpoker.model.PersistentRoom;
import com.example.estpoker.repository.PersistentRoomRepository;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

@Controller
public class GameController {

    private final PersistentRoomRepository persistentRoomRepository;

    public GameController(PersistentRoomRepository persistentRoomRepository) {
        this.persistentRoomRepository = persistentRoomRepository;
    }

    @GetMapping("/")
    public String landingPage() {
        return "index";
    }

    @PostMapping("/join")
    public String joinRoom(@RequestParam String participantName,
                           @RequestParam String roomCode,
                           @RequestParam(required = false, defaultValue = "false") boolean persistent,
                           @RequestParam(required = false, defaultValue = "false") boolean testRoom,
                           Model model) {

        participantName = participantName == null ? "" : participantName.trim();
        roomCode = roomCode == null ? "" : roomCode.trim();

        // Validierung: leere Felder
        if (participantName.isEmpty() || roomCode.isEmpty()) {
            String msg = url("Name und Raumcode dürfen nicht leer sein.");
            return "redirect:/?error=" + msg +
                    "&participantName=" + url(participantName) +
                    "&roomCode=" + url(roomCode) +
                    (persistent ? "&persistent=true" : "") +
                    (testRoom ? "&testRoom=true" : "");
        }

        if (persistent) {
            // Serverseitige Validierung: Name darf NICHT bereits belegt sein
            if (persistentRoomRepository.existsByNameIgnoreCase(roomCode)) {
                String msg = url("Der gewählte Raumname ist bereits vergeben. Bitte anderen Namen wählen.");
                return "redirect:/?error=" + msg +
                        "&participantName=" + url(participantName) +
                        "&roomCode=" + url(roomCode) +
                        "&persistent=true" +
                        (testRoom ? "&testRoom=true" : "");
            }

            // Neu anlegen (ID/createdAt/lastActiveAt via @PrePersist)
            PersistentRoom room = new PersistentRoom(roomCode);
            room.setTestRoom(testRoom);
            persistentRoomRepository.save(room);

            return "redirect:/room/" + room.getId() + "?participantName=" + url(participantName);
        }

        // Transient (nicht persistent): Verhalten wie bisher – roomCode bleibt die URL
        return "redirect:/room/" + url(roomCode) + "?participantName=" + url(participantName);
    }

    @GetMapping("/room/{codeOrId}")
    public String room(@PathVariable String codeOrId,
                       @RequestParam String participantName,
                       Model model) {

        Optional<PersistentRoom> persistentRoomOpt = persistentRoomRepository.findById(codeOrId);

        final String effectiveRoomDisplayName;
        final boolean isPersistent;
        final boolean isTestRoom;

        if (persistentRoomOpt.isPresent()) {
            PersistentRoom room = persistentRoomOpt.get();
            // Letzte Aktivität updaten (z. B. durch Betreten)
            room.touch();
            persistentRoomRepository.save(room);

            effectiveRoomDisplayName = room.getName();
            isPersistent = true;
            isTestRoom = room.isTestRoom();

            // Fürs Frontend ggf. nützlich
            model.addAttribute("persistentRoomId", room.getId());
        } else {
            // Transient: Der Pfad ist direkt der "Raumcode"
            effectiveRoomDisplayName = codeOrId;
            isPersistent = false;
            isTestRoom = false;
        }

        model.addAttribute("roomCode", effectiveRoomDisplayName);
        model.addAttribute("isPersistent", isPersistent);
        model.addAttribute("isTestRoom", isTestRoom);
        model.addAttribute("participantName", participantName);

        // Kartenreihen für room.html (th:each)
        model.addAttribute("cardsRow1", new String[]{"1", "2", "3", "5"});
        model.addAttribute("cardsRow2", new String[]{"8", "13", "20", "40"});
        model.addAttribute("cardsRow3", new String[]{"❓", "💬", "☕"});

        return "room";
    }

    // --- Hilfsfunktion zum URL-Encoden ---
    private static String url(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }
}
