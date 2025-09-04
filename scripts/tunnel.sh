#!/usr/bin/env bash
# Small helper to start a Cloudflare Quick Tunnel for local dev
# Works well on Windows via Git Bash.
# Default port: 8080 (override with first arg)

set -euo pipefail

PORT="${1:-8080}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${SCRIPT_DIR}/bin"


# Detect Windows Git Bash / MSYS / MINGW
uname_s="$(uname -s || echo "")"
is_windows=false
if [[ "${OS:-}" == "Windows_NT" ]] || [[ "$uname_s" =~ MINGW|MSYS ]]; then
  is_windows=true
fi

# Choose binary path + download URL
if $is_windows; then
  CF_BIN="$BIN_DIR/cloudflared.exe"
  CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
else
  CF_BIN="$BIN_DIR/cloudflared"
fi

# Ensure cloudflared is present (Windows auto-download; on *nix we try as well)
if [[ ! -f "$CF_BIN" ]]; then
  mkdir -p "$BIN_DIR"
  echo "• cloudflared not found – downloading to $CF_BIN …"

  if $is_windows; then
    curl -fsSL "$CF_URL" -o "$CF_BIN"
  else
    case "$uname_s" in
      Linux*)
        curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" \
          -o "$CF_BIN"
        chmod +x "$CF_BIN"
        ;;
      Darwin*)
        # Try arm64 first, then amd64
        TMP="$BIN_DIR/cloudflared-mac.tgz"
        if ! curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz" -o "$TMP"; then
          curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz" -o "$TMP"
        fi
        tar -xzf "$TMP" -C "$BIN_DIR" cloudflared
        rm -f "$TMP"
        CF_BIN="$BIN_DIR/cloudflared"
        chmod +x "$CF_BIN"
        ;;
      *)
        echo "Unsupported OS '$uname_s'. Please install cloudflared manually:"
        echo "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads"
        exit 1
        ;;
    esac
  fi
fi

echo "✅ Using: $CF_BIN"
echo "🌐 Starting Cloudflare Quick Tunnel → http://localhost:${PORT}"
echo "   (Press Ctrl+C to stop the tunnel)"
exec "$CF_BIN" tunnel --no-autoupdate --url "http://localhost:${PORT}"
