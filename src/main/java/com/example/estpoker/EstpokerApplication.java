package com.example.estpoker;

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
            long count = repo.count();
            System.out.println("📦 Anzahl persistenter Räume: " + count);
        };
    }
}
