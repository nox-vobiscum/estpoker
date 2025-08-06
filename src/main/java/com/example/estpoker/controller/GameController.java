package com.example.estpoker.controller;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.service.GameService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@Controller
public class GameController {

    private final GameService gameService;

    public GameController(GameService gameService) {
        this.gameService = gameService;
    }

    @GetMapping("/")
    public String index() {
        return "index";
    }

    @PostMapping("/join")
    public String joinRoom(@RequestParam String roomCode, @RequestParam String participantName, Model model) {
        Room room = gameService.getOrCreateRoom(roomCode);
        room.getOrCreateParticipant(participantName);

        return "redirect:/room/" + roomCode + "?participantName=" + participantName;
    }

    @PostMapping("/vote")
    public String vote(@RequestParam String roomCode, @RequestParam String participantName, @RequestParam String card) {
        Room room = gameService.getOrCreateRoom(roomCode);
        Participant participant = room.getOrCreateParticipant(participantName);
        participant.setVote(card);

        return "redirect:/room/" + roomCode + "?participantName=" + participantName;
    }

    @PostMapping("/reveal")
    public String reveal(@RequestParam String roomCode, @RequestParam String participantName) {
        gameService.revealCards(roomCode);
        return "redirect:/room/" + roomCode + "?participantName=" + participantName;
    }

    @PostMapping("/reset")
    public String reset(@RequestParam String roomCode, @RequestParam String participantName) {
        gameService.resetVotes(roomCode);
        return "redirect:/room/" + roomCode + "?participantName=" + participantName;
    }

    @GetMapping("/room/{roomCode}")
    public String showRoom(@PathVariable String roomCode, @RequestParam String participantName, Model model) {
        Room room = gameService.getRoom(roomCode);
        if (room == null) {
            return "redirect:/";
        }

        boolean isHost = room.getHost() != null && room.getHost().getName().equals(participantName);

        model.addAttribute("roomCode", roomCode);
        model.addAttribute("participantName", participantName);
        model.addAttribute("isHost", isHost);
        model.addAttribute("hostName", room.getHost() != null ? room.getHost().getName() : "Unbekannt");
        model.addAttribute("participants", room.getParticipants());
        model.addAttribute("averageVote", gameService.calculateAverageVote(room).map(a -> String.format("%.1f", a)).orElse("N/A"));
        model.addAttribute("participantsWithVotes", room.getParticipantsWithVotes());
        model.addAttribute("votesRevealed", room.areVotesRevealed());
        model.addAttribute("cards", List.of("1", "2", "3", "5", "8", "13", "20", "☕", "?", "🧑‍💼"));

        return "room";
    }
}
