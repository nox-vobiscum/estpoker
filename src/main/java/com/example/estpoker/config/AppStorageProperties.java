package com.example.estpoker.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Binds all keys under "app.storage".
 * Supports both "security=implicit|explicit|none" and a legacy "explicit=true|false".
 */
@ConfigurationProperties(prefix = "app.storage")
public class AppStorageProperties {

  private String mode = "none";
  private Ftps ftps = new Ftps();

  public String getMode() { return mode; }
  public void setMode(String mode) { this.mode = mode; }

  public Ftps getFtps() { return ftps; }
  public void setFtps(Ftps ftps) { this.ftps = ftps; }

  public enum Security { IMPLICIT, EXPLICIT, NONE }

  public static class Ftps {

    private String host;
    private int port = 21;
    private String user;
    private String pass;

    /** Base directory relative to the FTP user’s root (no leading slash). */
    private String baseDir = "";

    /** Always use passive mode behind NAT / PaaS. */
    private boolean passive = true;

    /** If set, overrides "security". explicit=false → implicit; explicit=true → explicit. */
    private Boolean explicit;

    /** Preferred way to select security. */
    private Security security = Security.IMPLICIT;

    /** Socket read timeout (control channel) in ms. */
    private Integer soTimeoutMs = 18000;

    /** Data channel timeout in ms. */
    private Integer dataTimeoutMs = 18000;

    /** Use UTF-8 for control channel and file names. */
    private Boolean useUtf8 = true;

    /** Enable extra logging (app-side). */
    private Boolean debug = false;

    // --- derived helper
    /** true → FTPS implicit (990), false → FTPS explicit (21). */
    public boolean isImplicitMode() {
      if (explicit != null) return !explicit;              // explicit=false means implicit
      return security == Security.IMPLICIT;
    }

    // --- getters / setters
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

    public Boolean getExplicit() { return explicit; }
    public void setExplicit(Boolean explicit) { this.explicit = explicit; }

    public Security getSecurity() { return security; }
    public void setSecurity(Security security) { this.security = security; }

    public Integer getSoTimeoutMs() { return soTimeoutMs; }
    public void setSoTimeoutMs(Integer soTimeoutMs) { this.soTimeoutMs = soTimeoutMs; }

    public Integer getDataTimeoutMs() { return dataTimeoutMs; }
    public void setDataTimeoutMs(Integer dataTimeoutMs) { this.dataTimeoutMs = dataTimeoutMs; }

    public Boolean getUseUtf8() { return useUtf8; }
    public void setUseUtf8(Boolean useUtf8) { this.useUtf8 = useUtf8; }

    public Boolean getDebug() { return debug; }
    public void setDebug(Boolean debug) { this.debug = debug; }
  }
}
