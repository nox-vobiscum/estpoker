#!/usr/bin/env sh
set -e

git config core.hooksPath .githooks

# mach alle Hooks ausführbar, Fehler ignorieren falls keine da
chmod +x .githooks/* 2>/dev/null || true

# Windows CRLF -> LF normalisieren (richtige \r, portable -i Variante)
if command -v sed >/dev/null 2>&1; then
  for f in .githooks/*; do
    [ -f "$f" ] || continue
    # GNU sed
    sed -i 's/\r$//' "$f" 2>/dev/null || \
    # BSD/macOS sed (braucht Backup-Suffix)
    sed -i '' 's/\r$//' "$f" 2>/dev/null || true
  done
fi

echo "Hooks aktiviert (core.hooksPath = .githooks)"
