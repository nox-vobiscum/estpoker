package com.example.estpoker.service;

import com.example.estpoker.config.AppStorageProperties;
import org.apache.commons.net.ftp.FTP;
import org.apache.commons.net.ftp.FTPSClient;
import org.springframework.beans.factory.annotation.Autowired;
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
                             @Autowired(required = false) Supplier<FTPSClient> ftpsSupplier) {
    this.props = props;
    this.ftpsSupplier = ftpsSupplier;
  }

  /** writes UTF-8 text to baseDir/relativePath */
  public void writeUtf8(String relativePath, String content) throws Exception {
    ensureFtpsMode();
    var cfg = props.getFtps();
    FTPSClient c = ftpsSupplier.get();
    try {
      c.connect(cfg.getHost(), cfg.getPort());
      c.execPBSZ(0); c.execPROT("P");
      if (!c.login(cfg.getUser(), cfg.getPass())) throw new IllegalStateException("login failed");
      if (cfg.isPassive()) c.enterLocalPassiveMode();
      c.setFileType(FTP.BINARY_FILE_TYPE);
      // cd base-dir (create if missing)
      if (!c.changeWorkingDirectory(cfg.getBaseDir())) {
        c.makeDirectory(cfg.getBaseDir());
        if (!c.changeWorkingDirectory(cfg.getBaseDir()))
          throw new IllegalStateException("cannot cd " + cfg.getBaseDir());
      }
      try (var in = new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8))) {
        if (!c.storeFile(relativePath, in)) {
          throw new IllegalStateException("storeFile failed (reply " + c.getReplyCode() + ")");
        }
      }
    } finally {
      try { c.logout(); } catch (Exception ignore) {}
      try { c.disconnect(); } catch (Exception ignore) {}
    }
  }

  /** reads UTF-8 text from baseDir/relativePath */
  public String readUtf8(String relativePath) throws Exception {
    ensureFtpsMode();
    var cfg = props.getFtps();
    FTPSClient c = ftpsSupplier.get();
    try {
      c.connect(cfg.getHost(), cfg.getPort());
      c.execPBSZ(0); c.execPROT("P");
      if (!c.login(cfg.getUser(), cfg.getPass())) throw new IllegalStateException("login failed");
      if (cfg.isPassive()) c.enterLocalPassiveMode();
      c.setFileType(FTP.BINARY_FILE_TYPE);
      if (!c.changeWorkingDirectory(cfg.getBaseDir()))
        throw new IllegalStateException("cannot cd " + cfg.getBaseDir());

      try (var out = new ByteArrayOutputStream()) {
        var is = c.retrieveFileStream(relativePath);
        if (is == null) throw new IllegalStateException("retrieveFileStream null (reply " + c.getReplyCode() + ")");
        is.transferTo(out);
        is.close();
        if (!c.completePendingCommand()) throw new IllegalStateException("completePendingCommand failed");
        return out.toString(StandardCharsets.UTF_8);
      }
    } finally {
      try { c.logout(); } catch (Exception ignore) {}
      try { c.disconnect(); } catch (Exception ignore) {}
    }
  }

  private void ensureFtpsMode() {
    if (!"ftps".equalsIgnoreCase(String.valueOf(props.getMode())))
      throw new IllegalStateException("app.storage.mode != ftps");
    if (ftpsSupplier == null) throw new IllegalStateException("no FTPS supplier");
  }
}
