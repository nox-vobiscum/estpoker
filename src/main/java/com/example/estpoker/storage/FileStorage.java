package com.example.estpoker.storage;

import java.io.IOException;
import java.util.List;

/** Minimal storage abstraction used by the app. */
public interface FileStorage {
  /** Uploads/overwrites the file at remotePath (relative to base). */
  void putBytes(String remotePath, byte[] bytes) throws IOException;

  /** Returns the bytes of the file or null if not found. */
  byte[] getBytes(String remotePath) throws IOException;

  /** Deletes the file if present. Returns true when it existed. */
  boolean delete(String remotePath) throws IOException;

  /** Lists plain file names in a directory (no recursion). Empty list if none. */
  List<String> list(String dirPath) throws IOException;

  /** Ensures the parent directories for a path exist. */
  void ensureParentDirs(String remotePath) throws IOException;
}
