#!/usr/bin/env bash
set -euo pipefail

# ───────────────────────────────
# run-and-tunnel.sh (Windows Git-Bash friendly)
# - Starts Spring Boot locally
# - Launches Cloudflare Quick Tunnel via scripts/tunnel.sh
# - Waits for DNS + HTTP readiness (no PowerShell; nslookup/ping only)
# - Optionally opens QR code, browser, clipboard
# ───────────────────────────────

# ---------- Config via env ----------
APP_BUILD="${APP_BUILD:-dev}"
PORT="${PORT:-8080}"
LOCAL_URL="http://localhost:${PORT}"

# UX toggles (defaults: QR yes; desktop/browser and clipboard off)
OPEN_QR="${OPEN_QR:-1}"
OPEN_DESKTOP="${OPEN_DESKTOP:-0}"
COPY_CLIPBOARD="${COPY_CLIPBOARD:-0}"

# Timeouts / limits
APP_WAIT_SEC="${APP_WAIT_SEC:-60}"
DNS_WAIT_TRIES="${DNS_WAIT_TRIES:-60}"
HTTP_WAIT_TRIES="${HTTP_WAIT_TRIES:-20}"   # with backoff up to ~2 min

# ---------- Logging helpers ----------
log(){ printf '%s\n' "$*" >&2; }
ok(){  log "✅ $*"; }
warn(){ log "⚠️  $*"; }
err(){ log "🛑 $*"; }

# ---------- Cleanup on exit ----------
APP_PID=""
TUNNEL_PID=""
cleanup(){
  if [[ -n "${TUNNEL_PID}" ]] && kill -0 "${TUNNEL_PID}" 2>/dev/null; then
    kill "${TUNNEL_PID}" 2>/dev/null || true
  fi
  if [[ -n "${APP_PID}" ]] && kill -0 "${APP_PID}" 2>/dev/null; then
    mvn -q -DskipTests spring-boot:stop >/dev/null 2>&1 || true
    kill "${APP_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# ---------- Wait for local app ----------
wait_local(){
  log "⏳ Waiting for ${LOCAL_URL} to respond…"
  local t=0
  until curl -fsS --max-time 2 "${LOCAL_URL}" >/dev/null 2>&1; do
    sleep 1
    t=$((t+1))
    if (( t >= APP_WAIT_SEC )); then
      err "App did not become ready on ${LOCAL_URL} within ${APP_WAIT_SEC}s"
      return 1
    fi
  done
  ok "App is reachable."
}

# ---------- DNS wait without PowerShell ----------
wait_dns(){
  # Wait until hostname resolves. Use nslookup or ping; no PowerShell, no noise.
  local host="$1" tries="${2:-$DNS_WAIT_TRIES}"
  log "⏳ Waiting DNS for ${host} …"
  for _ in $(seq 1 "${tries}"); do
    if command -v nslookup >/dev/null 2>&1; then
      nslookup "${host}" >/dev/null 2>&1 && return 0
    fi
    # Windows ping uses -n, Unix ping uses -c — try both quietly
    ping -n 1 "${host}" >/dev/null 2>&1 && return 0 || true
    ping -c 1 "${host}" >/dev/null 2>&1 && return 0 || true
    sleep 1
  done
  return 1
}

# ---------- HTTP wait with gentle backoff ----------
wait_http(){
  local url="$1" tries="${2:-$HTTP_WAIT_TRIES}"
  log "⏳ Waiting HTTP 200 on ${url} …"
  local i=1
  while (( i <= tries )); do
    if curl -fsS --max-time 3 -o /dev/null "${url}"; then
      ok "Tunnel is serving HTTP 200."
      return 0
    fi
    # backoff: 1,2,3,… max 10s
    local sleep_s="$i"; (( sleep_s > 10 )) && sleep_s=10
    sleep "${sleep_s}"
    i=$((i+1))
  done
  return 1
}

# ---------- Open helpers (Windows-friendly) ----------
open_url(){
  local url="$1"
  # Git-Bash: try powershell; fallback to 'cmd /c start'
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "Start-Process '$url'" >/dev/null 2>&1 || true
  else
    cmd.exe /c start "" "$url" >/dev/null 2>&1 || true
  fi
}

copy_clip(){
  local text="$1"
  if command -v clip.exe >/dev/null 2>&1; then
    printf '%s' "$text" | clip.exe
    ok "URL copied to clipboard."
  else
    warn "clip.exe not found; cannot copy to clipboard."
  fi
}

# ---------- Start app ----------
log "🚀 Starting app: ./mvnw spring-boot:run"
APP_BUILD="${APP_BUILD}" ./mvnw -q spring-boot:run &
APP_PID=$!

wait_local || { err "Stopping app (PID ${APP_PID})…"; exit 1; }

# ---------- Start tunnel (background) ----------
log "🔌 Starting tunnel via scripts/tunnel.sh …"
# We tee to a temp log to parse the URL
TUN_LOG="$(mktemp -t tunnel.log.XXXXXX)"
bash scripts/tunnel.sh | tee "${TUN_LOG}" &
TUNNEL_PID=$!

# ---------- Extract trycloudflare URL from tunnel output ----------
TUNNEL_URL=""
# Wait up to 60s to detect the URL from log
for _ in $(seq 1 60); do
  if grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "${TUN_LOG}" >/dev/null 2>&1; then
    TUNNEL_URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "${TUN_LOG}" | tail -n1)"
    break
  fi
  sleep 1
done

if [[ -z "${TUNNEL_URL}" ]]; then
  err "Failed to detect tunnel URL from scripts/tunnel.sh output."
  exit 1
fi

log "🌐 Tunnel URL detected: ${TUNNEL_URL}"

# ---------- DNS & HTTP readiness ----------
TUN_HOST="${TUNNEL_URL#https://}"
if ! wait_dns "${TUN_HOST}"; then
  warn "Tunnel hostname did not resolve in time; continuing anyway."
fi

if ! wait_http "${TUNNEL_URL}"; then
  warn "Tunnel URL did not return HTTP 200 in time (may still warm up)."
fi

# ---------- Post-actions ----------
if [[ "${OPEN_DESKTOP}" == "1" ]]; then
  open_url "${TUNNEL_URL}"
  ok "Opened tunnel URL in your default browser."
fi

if [[ "${COPY_CLIPBOARD}" == "1" ]]; then
  copy_clip "${TUNNEL_URL}"
fi

if [[ "${OPEN_QR}" == "1" ]]; then
  # Simple QR: open a QR image in the default browser
  QR_URL="https://api.qrserver.com/v1/create-qr-code/?data=$(printf '%s' "${TUNNEL_URL}" | sed 's/%/%25/g' | sed 's/ /%20/g')&size=320x320"
  open_url "${QR_URL}"
  log "📱 Opened QR code in your default browser. Scan with iPhone."
fi

log "   (Press Ctrl+C to stop the tunnel and the app)"
# Keep script alive while child processes run
wait
