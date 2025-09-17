package com.example.estpoker.service;

import com.example.estpoker.config.AppStorageProperties;
import org.apache.commons.net.ftp.FTP;
import org.apache.commons.net.ftp.FTPSClient;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
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

  public void writeUtf8(String name, String content) throws Exception {
    var cfg = props.getFtps();
    if (cfg == null) throw new IllegalStateException("FTPS config missing");
    String remote = normalizePath(cfg.getBaseDir(), name);

    FTPSClient c = null;
    try {
      c = openAndLogin();
      c.setFileType(FTP.BINARY_FILE_TYPE);
      try (var in = new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8))) {
        boolean ok = c.storeFile(remote, in);
        if (!ok) {
          throw new IllegalStateException("storeFile failed: " + c.getReplyCode() + " " + trim(c.getReplyString()));
        }
      }
    } finally {
      safeClose(c);
    }
  }

  public String readUtf8(String name) throws Exception {
    var cfg = props.getFtps();
    if (cfg == null) throw new IllegalStateException("FTPS config missing");
    String remote = normalizePath(cfg.getBaseDir(), name);

    FTPSClient c = null;
    try {
      c = openAndLogin();
      c.setFileType(FTP.BINARY_FILE_TYPE);
      var out = new ByteArrayOutputStream();
      boolean ok = c.retrieveFile(remote, out);
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

    // Same TLS dance as in diagnostics (works with DF)
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

  private static String normalizePath(String base, String name) {
    String b = base == null ? "" : base.trim();
    if (b.endsWith("/")) b = b.substring(0, b.length() - 1);
    String n = name.startsWith("/") ? name.substring(1) : name;
    return b.isEmpty() ? n : (b + "/" + n);
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
