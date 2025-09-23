package com.example.estpoker.controller;

import com.example.estpoker.persistence.PersistentRooms;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rooms")
public class RoomCheckController {

    private final PersistentRooms rooms;

    public RoomCheckController(PersistentRooms rooms) {
        this.rooms = rooms;
    }

    // Returns true if the given room name is already taken (case-insensitive)
    @GetMapping("/check")
    public boolean isTaken(@RequestParam String name) {
        String n = name == null ? "" : name.trim();
        if (n.isEmpty()) return false;
        return rooms.findByNameIgnoreCase(n).isPresent();
    }
}
