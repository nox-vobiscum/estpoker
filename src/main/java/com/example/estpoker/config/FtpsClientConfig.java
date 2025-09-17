package com.example.estpoker.config;

import org.apache.commons.net.ftp.FTPSClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.function.Supplier;

/** Factory for short-lived FTPSClient instances. Never touches the socket here. */
@Configuration
public class FtpsClientConfig {

  @Bean
  @ConditionalOnProperty(name = "app.storage.mode", havingValue = "ftps")
  @SuppressWarnings("deprecation")  // setControlKeepAliveTimeout, setControlKeepAliveReplyTimeout, setPassiveNatWorkaround
  public Supplier<FTPSClient> ftpsClientSupplier(AppStorageProperties props) {
    final var p = props.getFtps();
    return () -> {
      // Create only. No setSoTimeout() here (requires an open socket).
      FTPSClient c = new FTPSClient(p.isImplicitMode()); // implicit TLS (990) if true, explicit AUTH TLS (21) if false
      // ensure explicit FTPS uses AUTH TLS
      c.setAuthValue("TLS");
      // Safe pre-connect knobs:
      c.setControlKeepAliveTimeout(10);   // seconds, harmless pre-connect
      c.setControlKeepAliveReplyTimeout(10_000); // ms, harmless pre-connect
      if (p.isPassive()) {
        // This flag is safe to set pre-connect; real PASV happens after login in the service.
        c.setPassiveNatWorkaround(true);
      }
      if (p.isUseUtf8()) {
        c.setControlEncoding("UTF-8");
      }
      return c;
    };
  }
}
