package com.example.planningpoker.config;

import com.example.planningpoker.persistence.NoOpPersistentRooms;
import com.example.planningpoker.persistence.PersistentRooms;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PersistenceConfig {

  // Immer verfügbar: No-Op Implementierung (FTPS/JSON macht die Arbeit, nicht dieses Interface)
  @Bean
  @ConditionalOnMissingBean(PersistentRooms.class)
  public PersistentRooms persistentRoomsNoOp() {
    return new NoOpPersistentRooms();
  }
}
