package com.example.estpoker.controller;

import com.example.estpoker.repository.PersistentRoomRepository;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/rooms")
public class RoomCheckController {

    private final PersistentRoomRepository repository;

    public RoomCheckController(PersistentRoomRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/check")
    public boolean isNameTaken(@RequestParam("name") String displayName) {
        return repository.existsByDisplayNameIgnoreCase(displayName);
    }
}
