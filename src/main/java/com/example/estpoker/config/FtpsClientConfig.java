package com.example.estpoker.config;

import org.apache.commons.net.ftp.FTPSClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.function.Supplier;

/** Factory for short-lived FTPSClient instances. */
@Configuration
public class FtpsClientConfig {

  @Bean
  @SuppressWarnings("deprecation") // FTPClient#setDataTimeout / #setPassiveNatWorkaround are deprecated but practical
  @ConditionalOnProperty(name = "app.storage.mode", havingValue = "ftps")
  public Supplier<FTPSClient> ftpsClientSupplier(AppStorageProperties props) {
    final var p = props.getFtps();

    return () -> {
      // implicit TLS (true) vs explicit AUTH TLS (false) stays as in your model
      FTPSClient c = new FTPSClient(p.isImplicitMode());

      // SAFE pre-connect timeout: used for connect and initial reads
      if (p.getSoTimeoutMs() != null) {
        c.setDefaultTimeout(p.getSoTimeoutMs());
      }

      if (p.getDataTimeoutMs() != null) {
        // Still useful behind NAT even though marked deprecated
        c.setDataTimeout(p.getDataTimeoutMs());
      }

      // Helps when running behind proxies/NAT
      c.setPassiveNatWorkaround(true);

      return c;
    };
  }
}
