package com.example.estpoker.rooms.web;

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

import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * RoomsControllerPasswordTests (standalone MockMvc)
 *
 * Purpose:
 * - Verify password endpoints without starting Spring Boot application context.
 * - Uses Mockito mocks and registers Jackson converter explicitly.
 *
 * Covered endpoints:
 * - POST /api/rooms/{code}/set-password
 * - POST /api/rooms/{code}/password/check
 */
class RoomsControllerPasswordTests {

    private RoomStore store;
    private RoomPersistenceService service;
    private RoomsController controller;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        // Create pure Mockito mocks
        store = mock(RoomStore.class);
        service = mock(RoomPersistenceService.class);

        // Wire controller with mocks
        controller = new RoomsController(store, service);

        // Build standalone MockMvc with Jackson converter for @RequestBody
        mockMvc = MockMvcBuilders
                .standaloneSetup(controller)
                .setMessageConverters(new MappingJackson2HttpMessageConverter())
                .build();
    }

    @Nested
    @DisplayName("POST /api/rooms/{code}/set-password")
    class SetPassword {

        @Test
        @DisplayName("returns 204 and forwards provided password to service")
        void setPassword_withValue_returnsNoContent() throws Exception {
            String code = "abc123";
            String body = "{\"password\":\"s3cr3t\"}";

            mockMvc.perform(post("/api/rooms/{code}/set-password", code)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isNoContent());

            verify(service, times(1)).setPassword(eq(code), eq("s3cr3t"));
            verifyNoMoreInteractions(service, store);
        }

        @Test
        @DisplayName("returns 204 and clears password when body is {}")
        void setPassword_emptyObject_clearsPassword() throws Exception {
            String code = "roomX";

            mockMvc.perform(post("/api/rooms/{code}/set-password", code)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isNoContent());

            verify(service, times(1)).setPassword(eq(code), eq(null));
            verifyNoMoreInteractions(service, store);
        }
    }

    @Nested
    @DisplayName("POST /api/rooms/{code}/password/check")
    class CheckPassword {

        @Test
        @DisplayName("returns { ok: true } when service verifies successfully")
        void checkPassword_ok_true() throws Exception {
            String code = "room-ok";
            when(service.verifyPassword(code, "pw")).thenReturn(true);

            mockMvc.perform(post("/api/rooms/{code}/password/check", code)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"password\":\"pw\"}"))
                    .andExpect(status().isOk())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.ok", is(true)));

            verify(service, times(1)).verifyPassword(eq(code), eq("pw"));
            verifyNoMoreInteractions(service, store);
        }

        @Test
        @DisplayName("returns { ok: false } when service denies")
        void checkPassword_ok_false() throws Exception {
            String code = "room-no";
            when(service.verifyPassword(code, "bad")).thenReturn(false);

            mockMvc.perform(post("/api/rooms/{code}/password/check", code)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"password\":\"bad\"}"))
                    .andExpect(status().isOk())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.ok", is(false)));

            verify(service, times(1)).verifyPassword(eq(code), eq("bad"));
            verifyNoMoreInteractions(service, store);
        }

        @Test
        @DisplayName("accepts missing body and passes null to service")
        void checkPassword_missingBody_passesNull() throws Exception {
            String code = "room-null";
            when(service.verifyPassword(code, null)).thenReturn(true);

            mockMvc.perform(post("/api/rooms/{code}/password/check", code))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.ok", is(true)));

            ArgumentCaptor<String> pw = ArgumentCaptor.forClass(String.class);
            verify(service, times(1)).verifyPassword(eq(code), pw.capture());
            assertNull(pw.getValue(), "Password must be null when request body is missing");
            verifyNoMoreInteractions(service, store);
        }
    }
}
