package com.example.estpoker.service;

import com.example.estpoker.config.AppStorageProperties;
import org.apache.commons.net.ftp.FTPClient;
import org.apache.commons.net.ftp.FTPSClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.Duration;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Storage health probe:
 * - "local": always OK
 * - "ftps" : connect → login → (optional passive) → NOOP, with robust error mapping
 */
@Service
public class StorageDiagnosticsService {

  private final AppStorageProperties props;
  private final Supplier<FTPSClient> ftpsSupplier; // may be null if mode != ftps

  public StorageDiagnosticsService(AppStorageProperties props,
                                   @Autowired(required = false) Supplier<FTPSClient> ftpsSupplier) {
    this.props = Objects.requireNonNull(props, "props");
    this.ftpsSupplier = ftpsSupplier;
  }

  @SuppressWarnings("deprecation")  // setDataTimeout
  public StorageHealth ping() {
    final String mode = (props.getMode() == null ? "local" : props.getMode().trim().toLowerCase());

    if (!"ftps".equals(mode)) {
      // File-system mode: no remote hop
      return StorageHealth.ok(mode, "Local storage active", null, 0);
    }
    if (ftpsSupplier == null) {
      return StorageHealth.fail(mode, "FTPS mode configured but no client supplier", null, 0);
    }

    final var cfg = props.getFtps();
    final long t0 = System.nanoTime();
    FTPSClient c = null;

    try {
      c = ftpsSupplier.get();

      // 1) CONNECT
      c.connect(cfg.getHost(), cfg.getPort());
      // timeouts MUST be set after connect (socket exists now)
      if (cfg.getSoTimeoutMs() != null) {
        c.setSoTimeout(cfg.getSoTimeoutMs());
      }
      if (cfg.getDataTimeoutMs() != null) {
        // deprecated in commons-net, still widely used & harmless
        c.setDataTimeout(cfg.getDataTimeoutMs());
      }

      // 2) TLS data protection for explicit FTPS (AUTH TLS). Implicit often ignores this gracefully.
      try {
        c.execPBSZ(0);
        c.execPROT("P");
      } catch (IOException ignored) {
        // Some servers don't require it; safe to ignore
      }

      // 3) LOGIN
      if (!c.login(cfg.getUser(), cfg.getPass())) {
        final long ms = elapsedMs(t0);
        safeLogoutDisconnect(c);
        return StorageHealth.fail("ftps", "Login failed (credentials / policy)", String.valueOf(c.getReplyCode()), ms);
      }

      // 4) PASSIVE if requested
      if (cfg.isPassive()) {
        c.enterLocalPassiveMode();
      }

      // 5) LIGHTWEIGHT round-trip
      c.noop();

      final long ms = elapsedMs(t0);
      final String server = safeServerString(c);
      safeLogoutDisconnect(c);
      return StorageHealth.ok("ftps", "Connected + NOOP OK", server, ms);

    } catch (Exception ex) {
      final long ms = elapsedMs(t0);
      safeLogoutDisconnect(c);
      final String msg = ex.getClass().getSimpleName() + ": " + (ex.getMessage() == null ? "(no message)" : ex.getMessage());
      // Map all failures to a clean 503 payload; controller chooses the status code.
      return StorageHealth.fail("ftps", msg, null, ms);
    }
  }

  private static long elapsedMs(long t0) { return Duration.ofNanos(System.nanoTime() - t0).toMillis(); }

  private static String safeServerString(FTPClient c) {
    try { return c.getSystemType(); } catch (Exception ignore) { return null; }
  }

  private static void safeLogoutDisconnect(FTPClient c) {
    if (c == null) return;
    try { if (c.isAvailable()) c.logout(); } catch (Exception ignore) {}
    try { if (c.isConnected()) c.disconnect(); } catch (Exception ignore) {}
  }

  /** Minimal DTO for JSON responses. */
  public static final class StorageHealth {
    private boolean ok;
    private String mode;
    private String server;
    private long elapsedMs;
    private String message;

    public StorageHealth() {}

    public static StorageHealth ok(String mode, String message, String server, long elapsedMs) {
      StorageHealth h = new StorageHealth();
      h.ok = true; h.mode = mode; h.message = message; h.server = server; h.elapsedMs = elapsedMs;
      return h;
    }
    public static StorageHealth fail(String mode, String message, String server, long elapsedMs) {
      StorageHealth h = new StorageHealth();
      h.ok = false; h.mode = mode; h.message = message; h.server = server; h.elapsedMs = elapsedMs;
      return h;
    }

    public boolean isOk() { return ok; }
    public String getMode() { return mode; }
    public String getServer() { return server; }
    public long getElapsedMs() { return elapsedMs; }
    public String getMessage() { return message; }
  }
}
