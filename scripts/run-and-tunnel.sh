#!/usr/bin/env bash
# Starts your app and then opens a Cloudflare Quick Tunnel to it.
# Optimized for Windows + VSCode + Git Bash.
# Usage: bash scripts/run-and-tunnel.sh [PORT]
# Default PORT: 8080 (can also be provided via env PORT)
set -euo pipefail

PORT="${1:-${PORT:-8080}}"
# Adjust if you use Gradle/JAR/etc.
START_CMD="${START_CMD:-./mvnw spring-boot:run}"

echo "🚀 Starting app: ${START_CMD}"
# Launch the app in the background (use login shell so mvnw works on Git Bash)
bash -lc "$START_CMD" &
APP_PID=$!

# Ensure the app is stopped when this script exits
cleanup() {
  echo
  echo "🛑 Stopping app (PID $APP_PID)…"
  kill "$APP_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait until the app responds
echo "⏳ Waiting for http://localhost:${PORT} to respond…"
until curl -sSf "http://localhost:${PORT}/" >/dev/null 2>&1 || \
      curl -sSf "http://localhost:${PORT}/actuator/health" >/dev/null 2>&1; do
  sleep 1
done
echo "✅ App is reachable."

# Prefer a local helper if present; otherwise fall back to cloudflared in PATH
if [[ -x "scripts/tunnel.sh" ]]; then
  echo "🔌 Starting tunnel via scripts/tunnel.sh …"
  bash "scripts/tunnel.sh" "$PORT"
elif [[ -x "./tunnel.sh" ]]; then
  echo "🔌 Starting tunnel via ./tunnel.sh (fallback) …"
  bash "./tunnel.sh" "$PORT"
else
  echo "⚠️  No tunnel.sh found – trying to start cloudflared directly …"
  CF_BIN="${CLOUDFLARED_BIN:-cloudflared}"
  # On Windows the binary might be cloudflared.exe
  if ! command -v "$CF_BIN" >/dev/null 2>&1; then
    if command -v cloudflared.exe >/dev/null 2>&1; then
      CF_BIN="cloudflared.exe"
    else
      echo "❌ cloudflared not found. Install it (e.g., 'choco install cloudflared')"
      echo "   or add scripts/tunnel.sh."
      exit 1
    fi
  fi
  "$CF_BIN" tunnel --url "http://localhost:${PORT}" --no-autoupdate
fi
