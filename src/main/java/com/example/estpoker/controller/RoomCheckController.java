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

    @GetMapping("/check")
    public boolean isRoomNameAvailable(@RequestParam String name) {
        return !roomRepository.existsByNameIgnoreCase(name);
    }
}
