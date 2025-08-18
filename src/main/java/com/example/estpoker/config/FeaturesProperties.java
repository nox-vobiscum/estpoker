package com.example.estpoker.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "features")
public record FeaturesProperties(PersistentRooms persistentRooms) {

    public static record PersistentRooms(boolean enabled) { }
}
