package com.example.estpoker.config;

import com.example.estpoker.storage.FileStorage;
import com.example.estpoker.storage.FtpsFileStorage;
import org.apache.commons.net.ftp.FTPSClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.function.Supplier;

/** Creates a FileStorage bean based on app.storage.mode. */
@Configuration
public class StorageConfig {

  @Bean
  @ConditionalOnProperty(name = "app.storage.mode", havingValue = "ftps")
  public FileStorage ftpsFileStorage(
      Supplier<FTPSClient> ftpsClientSupplier,
      AppStorageProperties props
  ) {
    return new FtpsFileStorage(ftpsClientSupplier, props.getFtps());
  }
}
