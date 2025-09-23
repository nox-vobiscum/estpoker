package com.example.estpoker.controller;

import com.example.estpoker.model.Participant;
import com.example.estpoker.model.Room;
import com.example.estpoker.service.GameService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Standalone MVC test: no Spring context, no @MockBean.
 */
class RoomNameCheckControllerTest {

    private MockMvc mockMvcWith(GameService gameService) {
        return MockMvcBuilders.standaloneSetup(new RoomNameCheckController(gameService)).build();
    }

    @Test
    void nameTaken_returnsTrue_whenNameExistsInRoom() throws Exception {
        // given
        GameService gameService = Mockito.mock(GameService.class);
        Room room = new Room("team-x");
        room.addParticipant(new Participant("Alice"));
        when(gameService.getRoom("team-x")).thenReturn(room);

        MockMvc mvc = mockMvcWith(gameService);

        // when/then
        mvc.perform(get("/api/rooms/{roomCode}/name-taken", "team-x").param("name", "Alice"))
           .andExpect(status().isOk())
           .andExpect(content().string("true"));
    }

    @Test
    void nameTaken_returnsFalse_whenNameIsFree() throws Exception {
        // given
        GameService gameService = Mockito.mock(GameService.class);
        Room room = new Room("team-x");
        room.addParticipant(new Participant("Bob"));
        when(gameService.getRoom("team-x")).thenReturn(room);

        MockMvc mvc = mockMvcWith(gameService);

        // when/then
        mvc.perform(get("/api/rooms/{roomCode}/name-taken", "team-x").param("name", "Alice"))
           .andExpect(status().isOk())
           .andExpect(content().string("false"));
    }

    @Test
    void nameTaken_returnsFalse_whenRoomDoesNotExist() throws Exception {
        // given
        GameService gameService = Mockito.mock(GameService.class);
        when(gameService.getRoom("nope")).thenReturn(null);

        MockMvc mvc = mockMvcWith(gameService);

        // when/then
        mvc.perform(get("/api/rooms/{roomCode}/name-taken", "nope").param("name", "Alice"))
           .andExpect(status().isOk())
           .andExpect(content().string("false"));
    }
}
