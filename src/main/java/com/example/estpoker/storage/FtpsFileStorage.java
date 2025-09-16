package com.example.estpoker.storage;

import com.example.estpoker.config.AppStorageProperties;
import org.apache.commons.net.ftp.FTP;
import org.apache.commons.net.ftp.FTPFile;
import org.apache.commons.net.ftp.FTPSClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Short-lived FTPS operations: connect -> login -> do work -> logout/disconnect.
 * This is resilient on platforms where idle sockets are killed (mobile sleep, PaaS).
 */
public class FtpsFileStorage implements FileStorage {

  private final Supplier<FTPSClient> clientSupplier;
  private final AppStorageProperties.Ftps cfg;

  public FtpsFileStorage(Supplier<FTPSClient> clientSupplier, AppStorageProperties.Ftps cfg) {
    this.clientSupplier = Objects.requireNonNull(clientSupplier);
    this.cfg = Objects.requireNonNull(cfg);
  }

  private String base() {
    var b = cfg.getBaseDir();
    if (b == null || b.isBlank()) return "";
    // normalize: no trailing slash; always forward slashes
    b = b.replace('\\', '/');
    if (b.startsWith("/")) b = b.substring(1);
    if (b.endsWith("/")) b = b.substring(0, b.length() - 1);
    return b;
  }

  private String join(String... parts) {
    StringBuilder sb = new StringBuilder();
    for (String p : parts) {
      if (p == null || p.isBlank()) continue;
      String x = p.replace('\\', '/');
      if (x.startsWith("/")) x = x.substring(1);
      if (x.endsWith("/")) x = x.substring(0, x.length() - 1);
      if (sb.length() > 0) sb.append('/');
      sb.append(x);
    }
    return sb.toString();
  }

  /** Connects, logs in, enters passive mode, switches to binary + secure data channel. */
  private FTPSClient open() throws IOException {
    FTPSClient c = clientSupplier.get();
    try {
      c.connect(cfg.getHost(), cfg.getPort());
      if (!c.login(cfg.getUser(), cfg.getPass())) {
        throw new IOException("FTPS login failed for user " + cfg.getUser());
      }

      // Always use passive; works behind NAT/reverse proxies.
      c.enterLocalPassiveMode();

      // Protect data channel (TLS on data connection as well).
      c.execPBSZ(0);
      c.execPROT("P");

      // Use binary for JSON/blobs.
      c.setFileType(FTP.BINARY_FILE_TYPE);

      // Ensure UTF-8 listing/paths if enabled.
      if (Boolean.TRUE.equals(cfg.getUseUtf8())) {
        c.setControlEncoding(java.nio.charset.StandardCharsets.UTF_8.name());
      }

      // Change into base directory if configured.
      String b = base();
      if (!b.isEmpty()) {
        // create the base directory chain if missing
        ensureDirs(c, b);
        if (!c.changeWorkingDirectory("/" + b)) {
          throw new IOException("changeWorkingDirectory failed for base: " + b);
        }
      }

      return c;
    } catch (IOException e) {
      safeClose(c);
      throw e;
    }
  }

  private static void safeClose(FTPSClient c) {
    if (c == null) return;
    try { if (c.isConnected()) { c.logout(); c.disconnect(); } } catch (IOException ignore) {}
  }

  private static void ensureDirs(FTPSClient c, String path) throws IOException {
    // path like "data/rooms/a/b"
    String[] parts = path.replace('\\','/').split("/");
    String cur = "";
    for (String p : parts) {
      if (p == null || p.isBlank()) continue;
      cur = cur.isEmpty() ? p : (cur + "/" + p);
      // Try to cd; if fail, try to create then cd.
      if (!c.changeWorkingDirectory("/" + cur)) {
        if (!c.makeDirectory("/" + cur)) {
          // Allow concurrent "already exists".
          // Try to cd again right after.
        }
        if (!c.changeWorkingDirectory("/" + cur)) {
          throw new IOException("Cannot create or enter directory: " + cur);
        }
      }
    }
  }

  @Override
  public void putBytes(String remotePath, byte[] bytes) throws IOException {
    Objects.requireNonNull(remotePath, "remotePath");
    if (bytes == null) bytes = new byte[0];

    FTPSClient c = open();
    try {
      ensureParentDirs(remotePath, c);
      try (var in = new ByteArrayInputStream(bytes)) {
        if (!c.storeFile(remotePath, in)) {
          throw new IOException("storeFile failed for " + remotePath + " - reply: " + c.getReplyString());
        }
      }
    } finally {
      safeClose(c);
    }
  }

  @Override
  public byte[] getBytes(String remotePath) throws IOException {
    Objects.requireNonNull(remotePath, "remotePath");
    FTPSClient c = open();
    try (var out = new ByteArrayOutputStream(4096)) {
      var is = c.retrieveFileStream(remotePath);
      if (is == null) {
        // Either not found or another reply; try to drain reply.
        c.completePendingCommand();
        return null;
      }
      is.transferTo(out);
      is.close();
      if (!c.completePendingCommand()) {
        throw new IOException("retrieveFileStream completePendingCommand failed for " + remotePath);
      }
      return out.toByteArray();
    } finally {
      safeClose(c);
    }
  }

  @Override
  public boolean delete(String remotePath) throws IOException {
    Objects.requireNonNull(remotePath, "remotePath");
    FTPSClient c = open();
    try {
      return c.deleteFile(remotePath);
    } finally {
      safeClose(c);
    }
  }

  @Override
  public List<String> list(String dirPath) throws IOException {
    String d = (dirPath == null || dirPath.isBlank()) ? "." : dirPath;
    FTPSClient c = open();
    try {
      FTPFile[] files = c.listFiles(d);
      List<String> out = new ArrayList<>();
      if (files != null) {
        for (FTPFile f : files) {
          if (f == null) continue;
          if (f.isFile()) out.add(f.getName());
        }
      }
      return out;
    } finally {
      safeClose(c);
    }
  }

  @Override
  public void ensureParentDirs(String remotePath) throws IOException {
    FTPSClient c = open();
    try {
      ensureParentDirs(remotePath, c);
    } finally {
      safeClose(c);
    }
  }

  private void ensureParentDirs(String remotePath, FTPSClient c) throws IOException {
    String norm = remotePath.replace('\\','/');
    int idx = norm.lastIndexOf('/');
    if (idx < 0) return;
    String parent = norm.substring(0, idx);
    if (parent.isBlank()) return;
    // parent is relative to base(); we are already cd'ed into base().
    ensureDirs(c, join(base(), parent));
  }
}
