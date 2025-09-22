package com.example.estpoker.rooms.web;

import com.example.estpoker.rooms.model.StoredRoom;
import com.example.estpoker.rooms.repo.RoomStore;
import com.example.estpoker.rooms.service.RoomPersistenceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.Optional;

import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * RoomsControllerCrudTests (standalone MockMvc)
 *
 * Scope:
 * - GET /api/rooms/{code}
 * - GET /api/rooms/{code}/exists
 * - PUT /api/rooms/{code}
 * - DELETE /api/rooms/{code}
 *
 * Uses standalone MockMvc to avoid starting Spring Boot context.
 */
class RoomsControllerCrudTests {

    private RoomStore store;
    private RoomPersistenceService service;
    private RoomsController controller;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        store = mock(RoomStore.class);
        service = mock(RoomPersistenceService.class);

        controller = new RoomsController(store, service);
        mockMvc = MockMvcBuilders
                .standaloneSetup(controller)
                .setMessageConverters(new MappingJackson2HttpMessageConverter())
                .build();
    }

    @Nested
    @DisplayName("GET /api/rooms/{code}/exists")
    class Exists {

        @Test
        @DisplayName("returns exists=true when store says yes")
        void exists_true() throws Exception {
            when(store.exists("r1")).thenReturn(true);

            mockMvc.perform(get("/api/rooms/{code}/exists", "r1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.exists", is(true)));

            verify(store).exists("r1");
            verifyNoMoreInteractions(store, service);
        }

        @Test
        @DisplayName("returns exists=false when store says no")
        void exists_false() throws Exception {
            when(store.exists("r2")).thenReturn(false);

            mockMvc.perform(get("/api/rooms/{code}/exists", "r2"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.exists", is(false)));

            verify(store).exists("r2");
            verifyNoMoreInteractions(store, service);
        }
    }

    @Nested
    @DisplayName("GET /api/rooms/{code}")
    class GetRoom {

        @Test
        @DisplayName("returns 404 when not found")
        void notFound() throws Exception {
            when(store.load("missing")).thenReturn(Optional.empty());

            mockMvc.perform(get("/api/rooms/{code}", "missing"))
                    .andExpect(status().isNotFound());

            verify(store).load("missing");
            verifyNoMoreInteractions(store, service);
        }

        @Test
        @DisplayName("returns StoredRoomView JSON when found")
        void ok() throws Exception {
            StoredRoom r = StoredRoom.newWithCode("abc");
            r.setTitle("Demo");
            r.setOwner("host");
            r.getSettings().setSequenceId("fib");
            r.getSettings().setAutoRevealEnabled(true);
            r.getSettings().setAllowSpecials(false);
            r.getSettings().setTopicVisible(true);

            // Touch timestamps for deterministic non-null
            r.setCreatedAt(Instant.parse("2025-01-01T00:00:00Z"));
            r.setUpdatedAt(Instant.parse("2025-01-01T00:00:00Z"));

            when(store.load("abc")).thenReturn(Optional.of(r));

            mockMvc.perform(get("/api/rooms/{code}", "abc"))
                    .andExpect(status().isOk())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.code", is("abc")))
                    .andExpect(jsonPath("$.title", is("Demo")))
                    .andExpect(jsonPath("$.owner", is("host")))
                    .andExpect(jsonPath("$.settings.sequenceId", is("fib")))
                    .andExpect(jsonPath("$.settings.autoRevealEnabled", is(true)))
                    .andExpect(jsonPath("$.settings.allowSpecials", is(false)))
                    .andExpect(jsonPath("$.settings.topicVisible", is(true)));

            verify(store).load("abc");
            verifyNoMoreInteractions(store, service);
        }
    }

    @Nested
    @DisplayName("PUT /api/rooms/{code}")
    class UpsertRoom {

        @Test
        @DisplayName("creates new room when not existing and persists fields")
        void createAndPersist() throws Exception {
            when(store.load("new1")).thenReturn(Optional.empty());

            String payload = """
                    {
                      "title":"Title A",
                      "owner":"Owner A",
                      "sequenceId":"tshirt",
                      "autoRevealEnabled":true,
                      "allowSpecials":true,
                      "topicVisible":false
                    }
                    """;

            mockMvc.perform(put("/api/rooms/{code}", "new1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code", is("new1")))
                    .andExpect(jsonPath("$.title", is("Title A")))
                    .andExpect(jsonPath("$.owner", is("Owner A")))
                    .andExpect(jsonPath("$.settings.sequenceId", is("tshirt")))
                    .andExpect(jsonPath("$.settings.autoRevealEnabled", is(true)))
                    .andExpect(jsonPath("$.settings.allowSpecials", is(true)))
                    .andExpect(jsonPath("$.settings.topicVisible", is(false)));

            ArgumentCaptor<StoredRoom> saved = ArgumentCaptor.forClass(StoredRoom.class);
            verify(store).load("new1");
            verify(store).save(saved.capture());
            verifyNoMoreInteractions(store, service);

            StoredRoom sr = saved.getValue();
            assertEquals("new1", sr.getCode());
            assertEquals("Title A", sr.getTitle());
            assertEquals("Owner A", sr.getOwner());
            assertEquals("tshirt", sr.getSettings().getSequenceId());
            assertTrue(sr.getSettings().isAutoRevealEnabled());
            assertTrue(sr.getSettings().isAllowSpecials());
            assertFalse(sr.getSettings().isTopicVisible());
        }

        @Test
        @DisplayName("updates existing room and merges only provided fields")
        void updateMerge() throws Exception {
            StoredRoom existing = StoredRoom.newWithCode("e1");
            existing.setTitle("Old");
            existing.setOwner("keep");
            existing.getSettings().setSequenceId("fib");
            existing.getSettings().setAutoRevealEnabled(false);
            existing.getSettings().setAllowSpecials(false);
            existing.getSettings().setTopicVisible(true);

            when(store.load("e1")).thenReturn(Optional.of(existing));

            // Only override title and autoRevealEnabled
            String payload = """
                    {
                      "title":"New",
                      "autoRevealEnabled":true
                    }
                    """;

            mockMvc.perform(put("/api/rooms/{code}", "e1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title", is("New")))
                    .andExpect(jsonPath("$.owner", is("keep")))
                    .andExpect(jsonPath("$.settings.sequenceId", is("fib")))
                    .andExpect(jsonPath("$.settings.autoRevealEnabled", is(true)))
                    .andExpect(jsonPath("$.settings.allowSpecials", is(false)))
                    .andExpect(jsonPath("$.settings.topicVisible", is(true)));

            ArgumentCaptor<StoredRoom> saved = ArgumentCaptor.forClass(StoredRoom.class);
            verify(store).load("e1");
            verify(store).save(saved.capture());
            verifyNoMoreInteractions(store, service);

            StoredRoom sr = saved.getValue();
            assertEquals("New", sr.getTitle());
            assertEquals("keep", sr.getOwner());
            assertEquals("fib", sr.getSettings().getSequenceId());
            assertTrue(sr.getSettings().isAutoRevealEnabled());
            assertFalse(sr.getSettings().isAllowSpecials());
            assertTrue(sr.getSettings().isTopicVisible());
        }
    }

    @Nested
    @DisplayName("DELETE /api/rooms/{code}")
    class DeleteRoom {

        @Test
        @DisplayName("returns 404 when room does not exist")
        void deleteNotFound() throws Exception {
            when(store.exists("nope")).thenReturn(false);

            mockMvc.perform(delete("/api/rooms/{code}", "nope"))
                    .andExpect(status().isNotFound());

            verify(store).exists("nope");
            verifyNoMoreInteractions(store, service);
        }

        @Test
        @DisplayName("returns 204 and deletes when exists")
        void deleteOk() throws Exception {
            when(store.exists("yes")).thenReturn(true);

            mockMvc.perform(delete("/api/rooms/{code}", "yes"))
                    .andExpect(status().isNoContent());

            verify(store).exists("yes");
            verify(store).delete("yes");
            verifyNoMoreInteractions(store, service);
        }
    }
}
