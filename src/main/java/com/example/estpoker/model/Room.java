package com.example.estpoker.model;

import java.util.*;

public class Room {

    private final String code;
    private final List<Participant> participants = new ArrayList<>();
    private final Map<String, Participant> nameToParticipant = new HashMap<>();
    private boolean votesRevealed = false;
    private Participant host;

    public Room(String code) { this.code = code; }

    public String getCode() { return code; }

    public synchronized void addParticipant(Participant p, boolean asHost) {
        nameToParticipant.put(p.getName(), p);
        participants.add(p);
        if (asHost) {
            host = p;
            p.setHost(true);
        }
    }

    public synchronized Participant getParticipant(String name) {
        return nameToParticipant.get(name);
    }

    public synchronized List<Participant> getParticipants() {
        return participants;
    }

    public synchronized void setCardsRevealed(boolean revealed) { this.votesRevealed = revealed; }
    public synchronized boolean areVotesRevealed() { return votesRevealed; }

    public synchronized Participant getHost() { return host; }

    public synchronized void reset() {
        votesRevealed = false;
        for (Participant p : participants) {
            p.setVote(null);
        }
    }

    public synchronized void markInactive(String name) {
        Participant p = nameToParticipant.get(name);
        if (p != null) {
            p.setActive(false);
            p.setDisconnected(true);
        }
    }

    public synchronized void markActive(String name) {
        Participant p = nameToParticipant.get(name);
        if (p != null) {
            p.setActive(true);
            p.setDisconnected(false);
        }
    }

    public synchronized void removeParticipant(String name) {
        Participant p = nameToParticipant.remove(name);
        if (p != null) {
            participants.remove(p);
            // Host-Umschaltung macht assignNewHostIfNecessary(...)
        }
    }

    public synchronized Participant getOrCreateParticipant(String name) {
        Participant p = nameToParticipant.get(name);
        if (p == null) {
            p = new Participant(name);
            participants.add(p);
            nameToParticipant.put(name, p);
        }
        return p;
    }

    public synchronized List<Participant> getParticipantsWithVotes() {
        List<Participant> voted = new ArrayList<>();
        for (Participant p : participants) {
            if (p.getVote() != null) voted.add(p);
        }
        return voted;
    }

    public synchronized void addOrReactivateParticipant(String name) {
        Participant p = nameToParticipant.get(name);
        if (p == null) {
            p = new Participant(name);
            participants.add(p);
            nameToParticipant.put(name, p);
        }
        p.setActive(true);
        p.setDisconnected(false);

        if (host == null) {
            host = p;
            p.setHost(true);
            System.out.println("👑 Neuer Host: " + p.getName());
        }
    }

    public synchronized String assignNewHostIfNecessary(String oldHostName) {
        if (host != null && host.getName().equals(oldHostName)) {
            for (Participant p : participants) {
                if (p.isActive() && !p.getName().equals(oldHostName)) {
                    host.setHost(false);
                    host = p;
                    p.setHost(true);
                    return p.getName();
                }
            }
        }
        return null;
    }

    // ===== Rename-Support (Map-Key + Objektname aktualisieren, Kollisionen vermeiden) =====

    private String uniqueName(String desired) {
        String base = (desired == null || desired.isBlank()) ? "Guest" : desired;
        String candidate = base;
        int i = 2;
        while (nameToParticipant.containsKey(candidate)) {
            candidate = base + " (" + i + ")";
            i++;
        }
        return candidate;
    }

    /**
     * Benennt einen Teilnehmer um (identische Instanz bleibt erhalten).
     * Gibt den final verwendeten neuen Namen zurück oder null, wenn oldName unbekannt.
     */
    public synchronized String renameParticipant(String oldName, String desiredNewName) {
        Participant p = nameToParticipant.remove(oldName);
        if (p == null) return null;

        String newName = desiredNewName;
        if (newName == null || newName.isBlank()) newName = oldName;

        // Falls sich der Name tatsächlich ändert und es eine Kollision gibt, eindeutigen Namen wählen
        if (!oldName.equals(newName) && nameToParticipant.containsKey(newName)) {
            newName = uniqueName(newName);
        }

        // Objektname ändern + Map-Key erneuern
        p.setName(newName);
        nameToParticipant.put(newName, p);

        // participants-Liste enthält die gleiche Instanz -> keine Änderung nötig
        // Host-Status hängt an der Instanz -> bleibt erhalten

        return newName;
    }
}
