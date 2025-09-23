package com.example.estpoker.controller;

import com.example.estpoker.model.Room;
import com.example.estpoker.service.GameService;
import org.springframework.web.bind.annotation.*;

/**
 * Lightweight API to check if a display name is already taken in a given room.
 * Used by invite/index forms to prevent accidental collisions.
 */
@RestController
@RequestMapping("/api/rooms")
public class RoomNameCheckController {

    private final GameService gameService;

    public RoomNameCheckController(GameService gameService) {
        this.gameService = gameService;
    }

    /**
     * Returns true if the given name is already used by any participant in the room.
     * URL: GET /api/rooms/{roomCode}/name-taken?name=Alice
     */
    @GetMapping("/{roomCode}/name-taken")
    public boolean isNameTaken(
            @PathVariable String roomCode,
            @RequestParam String name
    ) {
        String rc = roomCode == null ? "" : roomCode.trim();
        String n  = name == null ? "" : name.trim();
        if (rc.isEmpty() || n.isEmpty()) return false;

        Room room = gameService.getRoom(rc);
        if (room == null) return false;

        return room.nameInUse(n);
    }
}
