package com.example.estpoker.persistence;

import java.util.Optional;

/**
 * Port for persisted room lookup without DB types.
 * Used only for small conveniences like case-insensitive code matching.
 */
public interface PersistentRooms {

    /**
     * Returns true if a stored room with this exact code exists.
     * In the FTPS/JSON setup this will typically be false or not implemented.
     */
    boolean exists(String code);

    /**
     * If a stored room exists for the given code ignoring case,
     * return the canonical (proper-case) code. Otherwise empty.
     */
    Optional<String> findByNameIgnoreCase(String code);
}
