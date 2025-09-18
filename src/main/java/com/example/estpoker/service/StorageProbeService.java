package com.example.estpoker.service;

import com.example.estpoker.config.AppStorageProperties;
import org.apache.commons.net.ftp.FTP;
import org.apache.commons.net.ftp.FTPSClient;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.function.Supplier;

@Service
public class StorageProbeService {

  private final AppStorageProperties props;
  private final Supplier<FTPSClient> ftpsSupplier;

  public StorageProbeService(AppStorageProperties props,
                             Supplier<FTPSClient> ftpsSupplier) {
    this.props = props;
    this.ftpsSupplier = ftpsSupplier;
  }

  /**
   * Write UTF-8 text to `{baseDir}/{name}`.
   * `name` may contain subfolders like "checks/probe.txt".
   */
  public void writeUtf8(String name, String content) throws Exception {
    var cfg = props.getFtps();
    if (cfg == null) throw new IllegalStateException("FTPS config missing");

    // split incoming name into (dir, file)
    var parts = splitDirFile(name);
    String subdir = parts[0];
    String filename = parts[1];

    FTPSClient c = null;
    try {
      c = openAndLogin();
      c.setFileType(FTP.BINARY_FILE_TYPE);

      // cd into baseDir, then into optional subdir from 'name'
      ensureCwd(c, cfg.getBaseDir());
      ensureCwd(c, subdir);

      try (var in = new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8))) {
        boolean ok = c.storeFile(filename, in);
        if (!ok) {
          throw new IllegalStateException("storeFile failed: " + c.getReplyCode() + " " + trim(c.getReplyString()));
        }
      }
    } finally {
      safeClose(c);
    }
  }

  /**
   * Read UTF-8 text from `{baseDir}/{name}`.
   * `name` may contain subfolders like "checks/probe.txt".
   */
  public String readUtf8(String name) throws Exception {
    var cfg = props.getFtps();
    if (cfg == null) throw new IllegalStateException("FTPS config missing");

    var parts = splitDirFile(name);
    String subdir = parts[0];
    String filename = parts[1];

    FTPSClient c = null;
    try {
      c = openAndLogin();
      c.setFileType(FTP.BINARY_FILE_TYPE);

      ensureCwd(c, cfg.getBaseDir());
      ensureCwd(c, subdir);

      var out = new ByteArrayOutputStream();
      boolean ok = c.retrieveFile(filename, out);
      if (!ok) {
        throw new IllegalStateException("retrieveFile failed: " + c.getReplyCode() + " " + trim(c.getReplyString()));
      }
      return out.toString(StandardCharsets.UTF_8);
    } finally {
      safeClose(c);
    }
  }

  // --- helpers --------------------------------------------------------------

  private FTPSClient openAndLogin() throws Exception {
    var cfg = props.getFtps();
    if (cfg == null) throw new IllegalStateException("FTPS config missing");

    if (cfg.getUser() == null || cfg.getUser().isBlank()) {
      throw new IllegalStateException("username missing (check DF_FTP_USER)");
    }
    if (cfg.getPass() == null || cfg.getPass().isBlank()) {
      throw new IllegalStateException("password missing (check DF_FTP_PASS)");
    }

    FTPSClient c = ftpsSupplier.get();
    c.connect(cfg.getHost(), cfg.getPort());

    // DF works fine with this sequence
    try { c.execPBSZ(0); } catch (Exception ignore) {}
    try { c.execPROT("P"); } catch (Exception ignore) {}

    if (!c.login(cfg.getUser(), cfg.getPass())) {
      throw new IllegalStateException("login failed: " + c.getReplyCode() + " " + trim(c.getReplyString()));
    }

    if (cfg.isPassive()) {
      c.enterLocalPassiveMode();
    }
    return c;
  }

  /** mkdir -p & cd into each segment of base (or subdir); ignores null/blank. */
  private static void ensureCwd(FTPSClient c, String path) throws IOException {
    if (path == null || path.isBlank()) return;
    String p = path.trim();
    // normalize slashes
    p = p.replace('\\', '/');
    // remove leading slash to stay relative to account home
    if (p.startsWith("/")) p = p.substring(1);
    for (String seg : p.split("/+")) {
      if (seg.isBlank()) continue;
      if (!c.changeWorkingDirectory(seg)) {
        if (!c.makeDirectory(seg)) {
          throw new IOException("mkdir '" + seg + "' failed → " + c.getReplyCode() + " " + c.getReplyString());
        }
        if (!c.changeWorkingDirectory(seg)) {
          throw new IOException("chdir '" + seg + "' failed → " + c.getReplyCode() + " " + c.getReplyString());
        }
      }
    }
  }

  /** Split "a/b/file.txt" → ["a/b", "file.txt"]; trims leading slash. */
  private static String[] splitDirFile(String raw) {
    if (raw == null) return new String[]{"", "probe.txt"};
    String p = raw.replace('\\', '/').trim();
    while (p.startsWith("/")) p = p.substring(1);
    if (p.endsWith("/")) p = p.substring(0, p.length() - 1);
    int i = p.lastIndexOf('/');
    if (i < 0) return new String[]{"", p.isEmpty() ? "probe.txt" : p};
    String dir = p.substring(0, i);
    String file = p.substring(i + 1);
    if (file.isBlank()) file = "probe.txt";
    return new String[]{dir, file};
  }

  private static String trim(String s) {
    return s == null ? "" : s.replace("\r", "").replace("\n", " ").trim();
  }

  private static void safeClose(FTPSClient c) {
    if (c == null) return;
    try { if (c.isAvailable()) c.logout(); } catch (Exception ignore) {}
    try { if (c.isConnected()) c.disconnect(); } catch (Exception ignore) {}
  }
}
