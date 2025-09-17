package com.example.estpoker.service;

import com.example.estpoker.config.AppStorageProperties;
import org.apache.commons.net.ftp.FTPClient;
import org.apache.commons.net.ftp.FTPSClient;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.time.Duration;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Pings the configured storage:
 * - "local" → always OK (no remote hop)
 * - "ftps"  → connects, login, optional passive, NOOP; maps result to a JSON-friendly DTO
 */
@Service
public class StorageDiagnosticsService {

  private final AppStorageProperties props;
  /** Optional: present only when app.storage.mode=ftps and FtpsClientConfig is active */
  private final Supplier<FTPSClient> ftpsSupplier;

  public StorageDiagnosticsService(AppStorageProperties props,
                                   @Nullable Supplier<FTPSClient> ftpsSupplier) {
    this.props = Objects.requireNonNull(props, "props");
    this.ftpsSupplier = ftpsSupplier; // may be null in non-FTPS mode
  }

  public StorageHealth ping() {
    final String mode = props.getMode() == null ? "local" : props.getMode().trim().toLowerCase();

    if (!"ftps".equals(mode)) {
      // Local (file-system) storage: no remote call needed
      return StorageHealth.ok(mode, "Local storage active", null, 0);
    }

    if (ftpsSupplier == null) {
      return StorageHealth.fail(mode, "FTPS mode configured but client supplier is not available", null, 0);
    }

    final var cfg = props.getFtps();
    final long t0 = System.nanoTime();

    FTPSClient c = null;
    try {
      c = ftpsSupplier.get();

      // --- Prefer IPv4 if configured (helps on hosts without public IPv6) ---
      InetAddress target = null;
      try {
        if (Boolean.TRUE.equals(cfg.getPreferIpv4())) {
          for (InetAddress a : InetAddress.getAllByName(cfg.getHost())) {
            if (a instanceof Inet4Address) { target = a; break; }
          }
        }
      } catch (Exception ignore) {
        // DNS issues → fall back to hostname connect
      }

      // Connect (use the resolved IPv4 target when available)
      if (target != null) {
        c.connect(target, cfg.getPort());
      } else {
        c.connect(cfg.getHost(), cfg.getPort());
      }
      final int connectReply = c.getReplyCode();

      // TLS data channel protection (explicit mode servers may require PBSZ/PROT)
      try {
        c.execPBSZ(0);
        c.execPROT("P");
      } catch (IOException ignore) {
        // Some servers do not require/allow this sequence; ignore.
      }

      // Login
      if (!c.login(cfg.getUser(), cfg.getPass())) {
        final long ms = elapsedMs(t0);
        safeLogoutDisconnect(c);
        return StorageHealth.fail("ftps", "Login failed (bad credentials or server policy)",
                                  String.valueOf(connectReply), ms);
      }

      // Optional passive
      if (cfg.isPassive()) {
        c.enterLocalPassiveMode();
      }

      // Lightweight roundtrip
      c.noop();

      final long ms = elapsedMs(t0);
      final String server = safeServerString(c);
      safeLogoutDisconnect(c);
      return StorageHealth.ok("ftps", "Connected + NOOP OK", server, ms);

    } catch (Exception ex) {
      final long ms = elapsedMs(t0);
      safeLogoutDisconnect(c);
      // Compact cause text, avoids huge stack traces in JSON
      final String msg = ex.getClass().getSimpleName() + ": " +
                         (ex.getMessage() == null ? "(no message)" : ex.getMessage());
      return StorageHealth.fail("ftps", msg, null, ms);
    }
  }

  private static long elapsedMs(long t0) {
    return Duration.ofNanos(System.nanoTime() - t0).toMillis();
  }

  private static String safeServerString(FTPClient c) {
    try {
      // System type is cheap and usually populated post-login
      return c.getSystemType();
    } catch (Exception ignore) {
      return null;
    }
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
