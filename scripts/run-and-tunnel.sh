#!/usr/bin/env bash
# Startet deine App und danach den Cloudflare-Tunnel
# Optimiert für Windows + VSCode + Git Bash
# Nutzung: bash scripts/run-and-tunnel.sh  [PORT]
# PORT default: 8080  (override via 1. Argument oder env PORT)
set -euo pipefail

PORT="${1:-${PORT:-8080}}"
# Passe den Startbefehl an, falls du Gradle/JAR nutzen willst:
START_CMD="${START_CMD:-./mvnw spring-boot:run}"

echo "🚀 Starte App: ${START_CMD}"
# App im Hintergrund starten
bash -lc "$START_CMD" &
APP_PID=$!

# Aufräumen beim Beenden
cleanup() {
  echo
  echo "🛑 Stoppe App (PID $APP_PID)…"
  kill "$APP_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Warten bis App erreichbar ist
echo "⏳ Warte bis http://localhost:${PORT} antwortet …"
until curl -sSf "http://localhost:${PORT}/" >/dev/null 2>&1 || \
      curl -sSf "http://localhost:${PORT}/actuator/health" >/dev/null 2>&1; do
  sleep 1
done
echo "✅ App ist erreichbar."

# Tunnel starten – bevorzugt scripts/tunnel.sh
if [[ -x "scripts/tunnel.sh" ]]; then
  echo "🔌 Starte Tunnel via scripts/tunnel.sh …"
  bash "scripts/tunnel.sh" "$PORT"
elif [[ -x "./tunnel.sh" ]]; then
  echo "🔌 Starte Tunnel via ./tunnel.sh (Fallback) …"
  bash "./tunnel.sh" "$PORT"
else
  echo "⚠️  Kein tunnel.sh gefunden – versuche cloudflared direkt zu starten …"
  CF_BIN="${CLOUDFLARED_BIN:-cloudflared}"
  # Unter Windows kann die EXE heißen
  if ! command -v "$CF_BIN" >/dev/null 2>&1; then
    if command -v cloudflared.exe >/dev/null 2>&1; then
      CF_BIN="cloudflared.exe"
    else
      echo "❌ cloudflared nicht gefunden. Bitte installiere es (z. B. 'choco install cloudflared')"
      echo "   oder lege scripts/tunnel.sh an."
      exit 1
    end
  fi
  "$CF_BIN" tunnel --url "http://localhost:${PORT}" --no-autoupdate
fi
