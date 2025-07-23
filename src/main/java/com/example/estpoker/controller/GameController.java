package com.example.estpoker.controller;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.service.GameService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
public class GameController {

    @Autowired
    private GameService gameService;

    @GetMapping("/create")
    public String createRoom(@RequestParam String code) {
        gameService.createRoom(code);
        return "Room '" + code + "' created.";
    }

    @GetMapping("/join")
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
        OptionalDouble avg = gameService.getAverageEstimate(code);
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
            entry.put("card", room.isRevealed() ? p.getCard() : "hidden");
            result.add(entry);
        }
        return result;
    }
}