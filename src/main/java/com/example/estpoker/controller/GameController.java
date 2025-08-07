package com.example.estpoker.controller;

import com.example.estpoker.model.PersistentRoom;
import com.example.estpoker.repository.PersistentRoomRepository;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

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
                           @RequestParam(required = false) boolean persistent,
                           Model model) {

        participantName = participantName.trim();
        roomCode = roomCode.trim();

        if (participantName.isEmpty() || roomCode.isEmpty()) {
            model.addAttribute("error", "Name und Raumcode dürfen nicht leer sein.");
            return "index";
        }

        // 🧠 Wenn persistent gewünscht und Raum noch nicht vorhanden → speichern
        if (persistent && !persistentRoomRepository.existsByNameIgnoreCase(roomCode)) {
            PersistentRoom room = new PersistentRoom();
            room.setName(roomCode);
            room.setRoomId(UUID.randomUUID().toString().substring(0, 6));
            room.setCreatedAtNow();
            persistentRoomRepository.save(room);

            System.out.println("💾 Persistenter Raum gespeichert: " + roomCode);
        }

        return "redirect:/room/" + roomCode + "?participantName=" + participantName;
    }

    @GetMapping("/room/{roomCode}")
    public String room(@PathVariable String roomCode,
                       @RequestParam String participantName,
                       Model model) {
        model.addAttribute("roomCode", roomCode);
        model.addAttribute("participantName", participantName);
        return "room";
    }
}
