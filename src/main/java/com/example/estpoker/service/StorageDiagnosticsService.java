package com.example.estpoker.service;

import com.example.estpoker.config.AppStorageProperties;
import org.apache.commons.net.ftp.FTPReply;
import org.apache.commons.net.ftp.FTPSClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.function.Supplier;

/**
 * Minimal diagnostics that actively dials FTPS and NOOPs the server.
 */
@Service
@ConditionalOnProperty(name = "app.storage.mode", havingValue = "ftps")
public class StorageDiagnosticsService {

  public record Status(boolean ok, String message, String mode, String baseDir) {}

  private final Supplier<FTPSClient> clientFactory;
  private final AppStorageProperties.Ftps cfg;

  public StorageDiagnosticsService(Supplier<FTPSClient> clientFactory,
                                   AppStorageProperties props) {
    this.clientFactory = clientFactory;
    this.cfg = props.getFtps();
  }

  public Status ping() {
    FTPSClient ftp = clientFactory.get();
    try {
      ftp.connect(cfg.getHost(), cfg.getPort());
      int reply = ftp.getReplyCode();
      if (!FTPReply.isPositiveCompletion(reply)) {
        return new Status(false, "Connect failed: reply=" + reply, "ftps", cfg.getBaseDir());
      }

      if (!ftp.login(cfg.getUser(), cfg.getPass())) {
        return new Status(false, "Login failed", "ftps", cfg.getBaseDir());
      }

      ftp.execPBSZ(0);
      ftp.execPROT("P");
      ftp.enterLocalPassiveMode();

      if (!ftp.changeWorkingDirectory(cfg.getBaseDir())) {
        return new Status(false, "CWD " + cfg.getBaseDir() + " failed", "ftps", cfg.getBaseDir());
      }

      // Round-trip
      if (!ftp.sendNoOp()) {
        return new Status(false, "NOOP failed", "ftps", cfg.getBaseDir());
      }

      return new Status(true, "OK", "ftps", cfg.getBaseDir());
    } catch (IOException e) {
      return new Status(false, "IOException: " + e.getMessage(), "ftps", cfg.getBaseDir());
    } finally {
      try { if (ftp.isConnected()) { ftp.logout(); ftp.disconnect(); } } catch (IOException ignore) {}
    }
  }
}
