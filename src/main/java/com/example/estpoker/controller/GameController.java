package com.example.estpoker.controller;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.service.GameService;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Controller
public class GameController {

    @Autowired
    private GameService gameService;

    @GetMapping("/create")
    public String createRoom(@RequestParam String code) {
        gameService.createRoom(code);
        return "Room '" + code + "' created.";
    }

    @GetMapping("/join")
    @ResponseBody
    public String joinRoom(@RequestParam String code, @RequestParam String name) {
        gameService.joinRoom(code, name);
        return name + " joined room " + code;
    }

    @GetMapping("/vote")
    public String vote(@RequestParam String code, @RequestParam String name, @RequestParam String card) {
        gameService.submitCard(code, name, card);
        return name + " voted in room " + code;
    }

    @GetMapping("/reveal")
    public String reveal(@RequestParam String code) {
        gameService.revealCards(code);
        return "Cards revealed in room " + code;
    }

    @GetMapping("/average")
    public String average(@RequestParam String code) {
        OptionalDouble avg = gameService.calculateAverageVote(gameService.getRoom(code));
        return avg.isPresent() ? "Average: " + avg.getAsDouble() : "No numeric votes";
    }

    @GetMapping("/participants")
    public List<Map<String, Object>> listParticipants(@RequestParam String code) {
        Room room = gameService.getRoom(code);
        if (room == null) return List.of();

        List<Map<String, Object>> result = new ArrayList<>();
        for (Participant p : room.getParticipants()) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("name", p.getName());
            entry.put("card", room.isRevealed() ? p.getVote() : "hidden");
            result.add(entry);
        }
        return result;
    }

    @GetMapping("/room")
public String showRoom(
        @RequestParam String roomCode,
        @RequestParam String participantName,
        Model model
) {
    Room room = gameService.getOrCreateRoom(roomCode);
    Participant participant = room.getOrCreateParticipant(participantName);

    List<String> cards = List.of("1", "2", "3", "5", "8", "13", "20", "☕", "❓", "📣");

    model.addAttribute("roomCode", roomCode);
    model.addAttribute("participantName", participantName);
    model.addAttribute("cards", cards);
    model.addAttribute("votesRevealed", room.areVotesRevealed());
    model.addAttribute("votes", room.getParticipants());
    
    // HIER: OptionalDouble korrekt behandeln
    OptionalDouble average = gameService.calculateAverageVote(room);
    average.ifPresent(avg -> model.addAttribute("average", avg));

    model.addAttribute("isHost", room.getHost().equals(participant));

    return "room";
}

@PostMapping("/room")
public String handleJoinForm(
        @RequestParam String roomCode,
        @RequestParam String participantName,
        Model model
) {
    Room room = gameService.getOrCreateRoom(roomCode);
    Participant participant = room.getOrCreateParticipant(participantName);

    List<String> cards = List.of("1", "2", "3", "5", "8", "13", "20", "☕", "❓", "📣");

    model.addAttribute("roomCode", roomCode);
    model.addAttribute("participantName", participantName);
    model.addAttribute("cards", cards);
    model.addAttribute("votesRevealed", room.areVotesRevealed());
    model.addAttribute("votes", room.getParticipants());

    OptionalDouble average = gameService.calculateAverageVote(room);
    average.ifPresent(avg -> model.addAttribute("average", avg));

    model.addAttribute("isHost", room.getHost().equals(participant));

    return "room";
}

}