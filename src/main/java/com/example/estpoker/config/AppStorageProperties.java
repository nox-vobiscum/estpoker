package com.example.estpoker.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties("app.storage")
public class AppStorageProperties {

  /** "local" (default) or "ftps" */
  private String mode = "local";

  /** FTPS subsection */
  private Ftps ftps = new Ftps();

  // --- getters/setters ---

  public String getMode() { return mode; }
  public void setMode(String mode) { this.mode = mode; }

  public Ftps getFtps() { return ftps; }
  public void setFtps(Ftps ftps) { this.ftps = ftps; }

  /** Mutable holder for FTPS connection options. */
  public static class Ftps {
    private String host;
    private int port = 21;
    private String user;
    private String pass;
    private String baseDir = "/rooms";

    private boolean passive = true;
    private boolean implicitMode = false;  // <-- binds app.storage.ftps.implicit-mode
    private Integer soTimeoutMs = 15000;
    private Integer dataTimeoutMs = 20000;
    private boolean useUtf8 = true;
    private boolean debug = false;

    // --- getters/setters ---

    public String getHost() { return host; }
    public void setHost(String host) { this.host = host; }

    public int getPort() { return port; }
    public void setPort(int port) { this.port = port; }

    public String getUser() { return user; }
    public void setUser(String user) { this.user = user; }

    public String getPass() { return pass; }
    public void setPass(String pass) { this.pass = pass; }

    public String getBaseDir() { return baseDir; }
    public void setBaseDir(String baseDir) { this.baseDir = baseDir; }

    public boolean isPassive() { return passive; }
    public void setPassive(boolean passive) { this.passive = passive; }

    public boolean isImplicitMode() { return implicitMode; }
    public void setImplicitMode(boolean implicitMode) { this.implicitMode = implicitMode; }

    public Integer getSoTimeoutMs() { return soTimeoutMs; }
    public void setSoTimeoutMs(Integer soTimeoutMs) { this.soTimeoutMs = soTimeoutMs; }

    public Integer getDataTimeoutMs() { return dataTimeoutMs; }
    public void setDataTimeoutMs(Integer dataTimeoutMs) { this.dataTimeoutMs = dataTimeoutMs; }

    public boolean isUseUtf8() { return useUtf8; }
    public void setUseUtf8(boolean useUtf8) { this.useUtf8 = useUtf8; }

    public boolean isDebug() { return debug; }
    public void setDebug(boolean debug) { this.debug = debug; }
  }
}
