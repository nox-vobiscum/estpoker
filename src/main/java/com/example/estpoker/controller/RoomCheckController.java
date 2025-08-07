package com.example.estpoker.controller;

import com.example.estpoker.repository.PersistentRoomRepository;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/rooms")
public class RoomCheckController {

    private final PersistentRoomRepository roomRepository;

    public RoomCheckController(PersistentRoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    // Liefert true, WENN der Name bereits vergeben ist (taken)
    @GetMapping("/check")
    public boolean isTaken(@RequestParam String name) {
        return roomRepository.existsByNameIgnoreCase(name.trim());
    }
}
