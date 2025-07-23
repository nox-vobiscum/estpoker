package com.example.estpoker.service;

import com.example.estpoker.model.Participant;

import java.util.*;

public class RoomManager {

    // Speichert pro Raumcode eine Liste von Teilnehmer*innen
    private final Map<String, List<Participant>> rooms = new HashMap<>();

    // Teilnehmer*in zu einem Raum hinzufügen
    public void addParticipant(String code, Participant participant) {
        rooms.computeIfAbsent(code, k -> new ArrayList<>());

        // Falls der Name schon im Raum vorhanden ist, ersetze die Person nicht doppelt
        boolean alreadyJoined = rooms.get(code).stream()
            .anyMatch(p -> p.getName().equals(participant.getName()));

        if (!alreadyJoined) {
            rooms.get(code).add(participant);
        }
    }

    // Gibt alle Teilnehmer*innen eines Raums zurück
    public List<Participant> getParticipants(String code) {
        return rooms.getOrDefault(code, Collections.emptyList());
    }

    // Speichert die Kartenwahl eines Teilnehmers
    public void setVote(String code, String name, String vote) {
        List<Participant> participants = rooms.get(code);
        if (participants != null) {
            for (Participant p : participants) {
                if (p.getName().equals(name)) {
                    p.setVote(vote);
                    break;
                }
            }
        }
    }

    // Gibt alle Stimmen eines Raumes zurück
    public List<String> getVotes(String code) {
        List<String> votes = new ArrayList<>();
        List<Participant> participants = rooms.get(code);
        if (participants != null) {
            for (Participant p : participants) {
                votes.add(p.getVote());
            }
        }
        return votes;
    }
}