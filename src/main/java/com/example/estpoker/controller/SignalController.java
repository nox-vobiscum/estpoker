package com.example.estpoker.controller;

import com.example.estpoker.model.Room;
import com.example.estpoker.service.GameService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/signal")
public class SignalController {

    private final GameService gameService;

    public SignalController(GameService gameService) {
        this.gameService = gameService;
    }

    /**
     * Lightweight beacon endpoint to mark a client as "left intentionally".
     * Called via navigator.sendBeacon() on pagehide/beforeunload.
     */
    @PostMapping("/bye")
    public ResponseEntity<Void> bye(
            @RequestParam("roomCode") String roomCode,
            @RequestParam("cid") String cid
    ) {
        if (roomCode == null || roomCode.isBlank() || cid == null || cid.isBlank()) {
            return ResponseEntity.noContent().build();
        }
        String name = gameService.getClientName(roomCode, cid);
        Room room = gameService.getRoom(roomCode);
        if (room != null && name != null) {
            gameService.markLeftIntentionally(room, name);
            return ResponseEntity.accepted().build();
        }
        return ResponseEntity.noContent().build();
    }
}
