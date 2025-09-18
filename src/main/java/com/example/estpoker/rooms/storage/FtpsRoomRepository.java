package com.example.estpoker.rooms.storage;

import com.example.estpoker.config.AppStorageProperties;
import com.example.estpoker.rooms.model.StoredRoom;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.net.ftp.FTP;
import org.apache.commons.net.ftp.FTPSClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;

@Repository
@ConditionalOnProperty(name = "app.storage.mode", havingValue = "ftps")
public class FtpsRoomRepository implements RoomRepository {

  private final AppStorageProperties props;
  private final Supplier<FTPSClient> ftpsSupplier;
  private final ObjectMapper mapper;

  public FtpsRoomRepository(AppStorageProperties props,
                            Supplier<FTPSClient> ftpsSupplier,
                            ObjectMapper mapper) {
    this.props = Objects.requireNonNull(props, "props");
    this.ftpsSupplier = Objects.requireNonNull(ftpsSupplier, "ftpsSupplier");
    this.mapper = Objects.requireNonNull(mapper, "mapper");
  }

  @Override
  public Optional<StoredRoom> load(String code) {
    String filePath = remotePathFor(code);

    FTPSClient c = null;
    try {
      c = openAndLogin();
      // Lesen in Memory
      var out = new ByteArrayOutputStream();
      c.setFileType(FTP.BINARY_FILE_TYPE);
      boolean ok = c.retrieveFile(filePath, out);
      if (!ok) {
        int rc = c.getReplyCode();
        String r = trim(c.getReplyString());
        // 550 → Datei nicht vorhanden
        if (rc == 550) return Optional.empty();
        throw new IllegalStateException("retrieveFile failed: " + rc + " " + r);
      }
      String json = out.toString(StandardCharsets.UTF_8);
      StoredRoom room = mapper.readValue(json, StoredRoom.class);
      return Optional.of(room);
    } catch (Exception e) {
      throw new IllegalStateException("load(" + code + ") failed", e);
    } finally {
      safeClose(c);
    }
  }

  @Override
  public void save(StoredRoom room) {
    Objects.requireNonNull(room, "room");
    String code = room.getCode();
    if (code == null || code.isBlank()) {
      throw new IllegalArgumentException("room.code must be set");
    }

    String dir = baseDir();
    String file = fileNameFor(code);
    String target = dir + "/" + file;
    String temp = dir + "/." + file + ".tmp";

    FTPSClient c = null;
    try {
      c = openAndLogin();
      ensureDirectories(c, dir);

      String json = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(room);
      c.setFileType(FTP.BINARY_FILE_TYPE);

      try (var in = new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8))) {
        if (!c.storeFile(temp, in)) {
          throw new IllegalStateException("storeFile(temp) failed: " + c.getReplyCode() + " " + trim(c.getReplyString()));
        }
      }

      // Atomic-ish replace: rename temp → target
      if (!c.rename(temp, target)) {
        // Aufräumen, falls rename fehlschlug
        try { c.deleteFile(temp); } catch (Exception ignore) {}
        throw new IllegalStateException("rename(temp→target) failed: " + c.getReplyCode() + " " + trim(c.getReplyString()));
      }
    } catch (Exception e) {
      throw new IllegalStateException("save(" + code + ") failed", e);
    } finally {
      safeClose(c);
    }
  }

  @Override
  public boolean exists(String code) {
    return load(code).isPresent();
  }

  @Override
  public void delete(String code) {
    String target = remotePathFor(code);
    FTPSClient c = null;
    try {
      c = openAndLogin();
      // mkdir ist nicht nötig zum Löschen; aber schadet nicht
      ensureDirectories(c, baseDir());
      // 250 / 200 → OK; 550 → nicht vorhanden
      if (!c.deleteFile(target)) {
        int rc = c.getReplyCode();
        if (rc != 550) {
          throw new IllegalStateException("deleteFile failed: " + rc + " " + trim(c.getReplyString()));
        }
      }
    } catch (Exception e) {
      throw new IllegalStateException("delete(" + code + ") failed", e);
    } finally {
      safeClose(c);
    }
  }

  // ----- helpers ------------------------------------------------------------

  private FTPSClient openAndLogin() throws Exception {
    var cfg = requireFtps();
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

  private AppStorageProperties.Ftps requireFtps() {
    var cfg = props.getFtps();
    if (cfg == null) throw new IllegalStateException("FTPS configuration missing");
    return cfg;
  }

  /** Ensure dir exists by walking segments (CWD + MKD). */
  private void ensureDirectories(FTPSClient c, String dir) throws Exception {
    String initial = c.printWorkingDirectory();
    try {
      String[] parts = dir.split("/");
      for (String p : parts) {
        if (p == null || p.isBlank()) continue;
        if (!c.changeWorkingDirectory(p)) {
          // versuchen anzulegen
          c.makeDirectory(p);
          if (!c.changeWorkingDirectory(p)) {
            throw new IllegalStateException("Cannot enter/create directory '" + p + "': "
                + c.getReplyCode() + " " + trim(c.getReplyString()));
          }
        }
      }
    } finally {
      try { c.changeWorkingDirectory(initial); } catch (Exception ignore) {}
    }
  }

  private String baseDir() {
    String b = requireFtps().getBaseDir();
    if (b == null) b = "";
    b = b.trim();
    while (b.endsWith("/")) b = b.substring(0, b.length()-1);
    return b;
  }

  private String fileNameFor(String code) {
    String s = sanitizeCode(code);
    return s + ".json";
  }

  private String remotePathFor(String code) {
    return baseDir() + "/" + fileNameFor(code);
  }

  private static String sanitizeCode(String code) {
    String s = Objects.requireNonNull(code, "code").trim();
    if (!s.matches("[A-Za-z0-9_-]{1,64}")) {
      throw new IllegalArgumentException("invalid room code: " + code);
    }
    return s;
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
