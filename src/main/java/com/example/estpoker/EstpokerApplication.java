package com.example.estpoker;

import com.example.estpoker.model.PersistentRoom;
import com.example.estpoker.repository.PersistentRoomRepository;
import com.example.estpoker.repository.PingRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class EstpokerApplication {

    public static void main(String[] args) {
        SpringApplication.run(EstpokerApplication.class, args);
    }

    @Bean
    public CommandLineRunner testDatabaseConnection(PingRepository pingRepository) {
        return args -> {
            long count = pingRepository.count();
            System.out.println("✅ Datenbank-Verbindung erfolgreich – Ping count: " + count);
        };
    }

    @Bean
    public CommandLineRunner testPersistentRoom(PersistentRoomRepository repo) {
        return args -> {
            if (!repo.existsByDisplayNameIgnoreCase("testRaum")) {
                PersistentRoom room = new PersistentRoom("A1b2C3", "testRaum");
                repo.save(room);
                System.out.println("✅ Test-Raum gespeichert!");
            } else {
                System.out.println("ℹ️ Test-Raum existiert bereits.");
            }

            repo.findAll().forEach(r ->
                System.out.println("📦 Raum: " + r.getDisplayName() + " (" + r.getRoomCode() + ")"));
        };
    }
}
