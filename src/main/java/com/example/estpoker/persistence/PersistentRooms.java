package com.example.estpoker.persistence;

import com.example.estpoker.model.PersistentRoom;

import java.util.Optional;

/**
 * Port für persistente Räume: per Feature-Flag entweder echte JPA-Implementierung
 * oder No-Op (macht nichts, hält die DB schlafend).
 */
public interface PersistentRooms {

    boolean existsByNameIgnoreCase(String name);

    Optional<PersistentRoom> findByNameIgnoreCase(String name);

    /**
     * Speichert den Raum (No-Op bei deaktivierter Persistenz).
     * @return der gespeicherte Raum (oder bei No-Op: das unveränderte Objekt)
     */
    PersistentRoom save(PersistentRoom room);
}
