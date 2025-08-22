#!/usr/bin/env sh
set -e

git config core.hooksPath .githooks
chmod +x .githooks/*  true

# Auf Windows evtl. CRLF -> LF normalisieren
if command -v sed >/dev/null 2>&1; then
  for f in .githooks/*; do sed -i 's/r$//' "$f" 2>/dev/null  true; done
fi

echo "Hooks aktiviert (core.hooksPath = .githooks)"
