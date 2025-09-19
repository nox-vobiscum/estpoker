package com.example.estpoker.rooms.repo;

import com.example.estpoker.config.AppStorageProperties;
import com.example.estpoker.rooms.model.StoredRoom;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.net.ftp.FTP;
import org.apache.commons.net.ftp.FTPFile;
import org.apache.commons.net.ftp.FTPSClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;

@Component
@ConditionalOnProperty(name = "app.storage.mode", havingValue = "ftps")
public class FtpsRoomStore implements RoomStore {

  private final AppStorageProperties props;
  private final Supplier<FTPSClient> ftpsSupplier;
  private final ObjectMapper om;

  public FtpsRoomStore(AppStorageProperties props, Supplier<FTPSClient> ftpsSupplier) {
    this.props = Objects.requireNonNull(props, "props");
    this.ftpsSupplier = Objects.requireNonNull(ftpsSupplier, "ftpsSupplier");
    this.om = new ObjectMapper().findAndRegisterModules();
  }

  // === API =================================================================

  @Override
  public Optional<StoredRoom> load(String code) throws Exception {
    String remote = remotePath(code);
    FTPSClient c = null;
    try {
      c = openAndLogin();
      c.setFileType(FTP.BINARY_FILE_TYPE);

      var out = new ByteArrayOutputStream();
      boolean ok = c.retrieveFile(remote, out);
      if (!ok) {
        int rc = c.getReplyCode();
        // 550 -> Not found (DF meldet das so)
        if (rc == 550) return Optional.empty();
        throw new IllegalStateException("retrieveFile failed: " + rc + " " + trim(c.getReplyString()));
      }
      StoredRoom r = om.readValue(out.toByteArray(), StoredRoom.class);
      return Optional.ofNullable(r);
    } finally {
      safeClose(c);
    }
  }

  @Override
  public void save(StoredRoom room) throws Exception {
    Objects.requireNonNull(room, "room");
    if (room.getCode() == null || room.getCode().isBlank()) {
      throw new IllegalArgumentException("StoredRoom.code is required");
    }
    // Timestamps pflegen
    if (room.getCreatedAt() == null) room.touchCreatedIfNull();
    room.touchUpdated();

    String remote = remotePath(room.getCode());
    byte[] json = om.writerWithDefaultPrettyPrinter().writeValueAsBytes(room);

    FTPSClient c = null;
    try {
      c = openAndLogin();
      c.setFileType(FTP.BINARY_FILE_TYPE);
      try (var in = new ByteArrayInputStream(json)) {
        if (!c.storeFile(remote, in)) {
          throw new IllegalStateException("storeFile failed: " + c.getReplyCode() + " " + trim(c.getReplyString()));
        }
      }
    } finally {
      safeClose(c);
    }
  }

  @Override
  public boolean exists(String code) throws Exception {
    String remote = remotePath(code);
    FTPSClient c = null;
    try {
      c = openAndLogin();
      FTPFile[] files = c.listFiles(remote);
      return files != null && files.length == 1 && files[0].isFile();
    } finally {
      safeClose(c);
    }
  }

  @Override
  public void delete(String code) throws Exception {
    String remote = remotePath(code);
    FTPSClient c = null;
    try {
      c = openAndLogin();
      // Nicht existiert -> ok
      FTPFile[] files = c.listFiles(remote);
      if (files == null || files.length == 0) return;

      if (!c.deleteFile(remote)) {
        int rc = c.getReplyCode();
        if (rc == 550) return; // already gone
        throw new IllegalStateException("deleteFile failed: " + rc + " " + trim(c.getReplyString()));
      }
    } finally {
      safeClose(c);
    }
  }

  // === intern ===============================================================

  private FTPSClient openAndLogin() throws Exception {
    var cfg = props.getFtps();
    if (cfg == null) throw new IllegalStateException("FTPS config missing");

    FTPSClient c = ftpsSupplier.get();
    c.connect(cfg.getHost(), cfg.getPort());
    try { c.execPBSZ(0); } catch (Exception ignore) {}
    try { c.execPROT("P"); } catch (Exception ignore) {}
    if (!c.login(cfg.getUser(), cfg.getPass())) {
      throw new IllegalStateException("login failed: " + c.getReplyCode() + " " + trim(c.getReplyString()));
    }
    if (cfg.isPassive()) c.enterLocalPassiveMode();
    return c;
  }

  private String remotePath(String code) {
    String base = String.valueOf(props.getFtps().getBaseDir()).trim();
    if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
    String safeCode = code.trim();
    return base.isEmpty() ? (safeCode + ".json") : (base + "/" + safeCode + ".json");
  }

  private static void safeClose(FTPSClient c) {
    if (c == null) return;
    try { if (c.isAvailable()) c.logout(); } catch (Exception ignore) {}
    try { if (c.isConnected()) c.disconnect(); } catch (Exception ignore) {}
  }

  private static String trim(String s) {
    return s == null ? "" : s.replace("\r", "").replace("\n", " ").trim();
  }
}
