package com.example.estpoker.config;

import org.apache.commons.net.ftp.FTPSClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.SocketException;
import java.util.function.Supplier;

/** Factory for short-lived FTPSClient instances. */
@Configuration
public class FtpsClientConfig {

  @Bean
  @SuppressWarnings("deprecation") // FTPClient#setDataTimeout / #setPassiveNatWorkaround are deprecated but useful in practice
  @ConditionalOnProperty(name = "app.storage.mode", havingValue = "ftps")
  public Supplier<FTPSClient> ftpsClientSupplier(AppStorageProperties props) {
    final var p = props.getFtps();

    return () -> {
      // true → implicit TLS (port 990); false → explicit AUTH TLS (port 21)
      FTPSClient c = new FTPSClient(p.isImplicitMode());

      try {
        if (p.getSoTimeoutMs() != null) {
          c.setSoTimeout(p.getSoTimeoutMs());
        }
      } catch (SocketException e) {
        // Convert checked → unchecked; supplier cannot throw checked exceptions
        throw new IllegalStateException("Failed to set SO_TIMEOUT on FTPSClient", e);
      }

      if (p.getDataTimeoutMs() != null) {
        // Deprecated in Apache Commons Net, but still useful behind NAT
        c.setDataTimeout(p.getDataTimeoutMs());
      }

      // Helps when running behind proxies/NAT
      c.setPassiveNatWorkaround(true);

      return c;
    };
  }
}
