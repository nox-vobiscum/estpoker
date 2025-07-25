package com.example.estpoker.controller;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.service.GameService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Controller
public class GameController {

    @Autowired
    private GameService gameService;

    private final List<String> cards = List.of("1", "2", "3", "5", "8", "13", "20", "☕", "❓", "📣");

    @GetMapping("/room")
    public String showRoom(
            @RequestParam String roomCode,
            @RequestParam String participantName,
            Model model
    ) {
        Room room = gameService.getOrCreateRoom(roomCode);
        Participant participant = room.getOrCreateParticipant(participantName);

        model.addAttribute("roomCode", roomCode);
        model.addAttribute("participantName", participantName);
        model.addAttribute("hostName", room.getHost().getName());
        model.addAttribute("isHost", room.getHost().equals(participant));
        model.addAttribute("cards", cards);
        model.addAttribute("votesRevealed", room.areVotesRevealed());
        model.addAttribute("votes", room.getParticipants());
        model.addAttribute("selectedCard", participant.getVote()); // <- Neu für Hervorhebung

        if (room.areVotesRevealed()) {
            gameService.calculateAverageVote(room).ifPresentOrElse(
                avg -> model.addAttribute("averageVote", String.format("%.1f", avg)),
                () -> model.addAttribute("averageVote", "–")
            );
        }

        return "room";
    }

    @PostMapping("/room")
    public String handleJoinForm(
            @RequestParam String roomCode,
            @RequestParam String participantName,
            @RequestParam(required = false) String card,
            Model model
    ) {
        Room room = gameService.getOrCreateRoom(roomCode);
        Participant participant = room.getOrCreateParticipant(participantName);

        if (card != null && !card.isEmpty()) {
            participant.setVote(card);
        }

        model.addAttribute("roomCode", roomCode);
        model.addAttribute("participantName", participantName);
        model.addAttribute("hostName", room.getHost().getName());
        model.addAttribute("isHost", room.getHost().equals(participant));
        model.addAttribute("cards", cards);
        model.addAttribute("votesRevealed", room.areVotesRevealed());
        model.addAttribute("votes", room.getParticipants());
        model.addAttribute("selectedCard", participant.getVote()); // <- Neu für Hervorhebung

        if (room.areVotesRevealed()) {
            gameService.calculateAverageVote(room).ifPresentOrElse(
                avg -> model.addAttribute("averageVote", String.format("%.1f", avg)),
                () -> model.addAttribute("averageVote", "–")
            );
        }

        return "room";
    }

    @PostMapping("/reveal")
    public String revealCards(
            @RequestParam String roomCode,
            @RequestParam String participantName
    ) {
        Room room = gameService.getRoom(roomCode);
        if (room != null && room.getHost().getName().equals(participantName)) {
            gameService.revealCards(roomCode);
        }

        return "redirect:/room?roomCode=" + roomCode + "&participantName=" + participantName;
    }

    @PostMapping("/reset")
    public String resetVotes(
            @RequestParam String roomCode,
            @RequestParam String participantName
    ) {
        Room room = gameService.getRoom(roomCode);
        if (room != null && room.getHost().getName().equals(participantName)) {
            gameService.resetVotes(roomCode);
        }

        return "redirect:/room?roomCode=" + roomCode + "&participantName=" + participantName;
    }
}
