#!/usr/bin/env bash
# Purpose: Start Spring Boot locally, wait until reachable, then start a Cloudflare Quick Tunnel.
# Extras (feature flags):
#   OPEN_QR=1         # open QR code in default browser (default 1)
#   OPEN_DESKTOP=0    # open tunnel URL in desktop browser (default 0)
#   COPY_CLIPBOARD=0  # copy tunnel URL to clipboard (default 0)
#
# Usage (Git Bash on Windows):
#   APP_BUILD="v0.8.0 ($(date +%F), $(git rev-parse --short HEAD))" \
#   OPEN_QR=1 OPEN_DESKTOP=0 COPY_CLIPBOARD=0 \
#   bash scripts/run-and-tunnel.sh
#
# Notes:
# - English-only comments.
# - Minimal changes, single-responsibility helper.

set -euo pipefail

# ------------------------- config --------------------------------------------

APP_URL="${APP_URL:-http://localhost:8080}"
MVN_CMD="${MVN_CMD:-./mvnw spring-boot:run}"
TUNNEL_SCRIPT="${TUNNEL_SCRIPT:-scripts/tunnel.sh}"

# Feature flags (defaults for your workflow: QR yes, others no)
OPEN_QR="${OPEN_QR:-1}"
OPEN_DESKTOP="${OPEN_DESKTOP:-0}"
COPY_CLIPBOARD="${COPY_CLIPBOARD:-0}"

# ------------------------- helpers -------------------------------------------

log() { printf "%s\n" "$*"; }

open_url() {
  local u="$1"
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "Start-Process '$u'" >/dev/null 2>&1 || true
    return 0
  fi
  if command -v cmd.exe >/dev/null 2>&1; then
    cmd.exe /C start "" "$u" >/dev/null 2>&1 || true
    return 0
  fi
  if command -v rundll32.exe >/dev/null 2>&1; then
    rundll32.exe url.dll,FileProtocolHandler "$u" >/dev/null 2>&1 || true
    return 0
  fi
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$u" >/dev/null 2>&1 || true
    return 0
  fi
  return 1
}

copy_clip() {
  if command -v clip.exe >/dev/null 2>&1; then
    printf "%s" "$1" | clip.exe >/dev/null 2>&1 || true
  fi
}

wait_http_ok() {
  # Poll quietly until URL returns HTTP 2xx/3xx (curl -f fails on 4xx/5xx).
  local url="$1" tries="${2:-60}"
  log "⏳ Waiting HTTP 200 on ${url} …"
  for _ in $(seq 1 "$tries"); do
    if curl -fs -o /dev/null "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_dns() {
  # Wait until the hostname resolves (quiet). 1/sec, bounded.
  local host="$1" tries="${2:-60}"
  log "⏳ Waiting DNS for ${host} …"
  for _ in $(seq 1 "$tries"); do
    if command -v powershell.exe >/dev/null 2>&1; then
      # Resolve-DnsName returns nonzero on failure; we suppress output.
      powershell.exe -NoProfile -Command ^
        "[bool](Resolve-DnsName -Name '$host' -ErrorAction SilentlyContinue)" \
        >/dev/null 2>&1 && return 0
    fi
    if command -v nslookup >/dev/null 2>&1; then
      nslookup "$host" >/dev/null 2>&1 && return 0
    fi
    # ping works on both Win ( -n 1 ) and Unix ( -c 1 )
    ping -n 1 "$host" >/dev/null 2>&1 && return 0 || true
    ping -c 1 "$host" >/dev/null 2>&1 && return 0 || true
    sleep 1
  done
  return 1
}

# ------------------------- lifecycle -----------------------------------------

APP_PID=""
TUNNEL_PID=""
CF_LOG="${TMPDIR:-/tmp}/cf_tunnel_${RANDOM}$$.log"

cleanup() {
  if [ -n "${TUNNEL_PID}" ] && kill -0 "${TUNNEL_PID}" 2>/dev/null; then
    kill "${TUNNEL_PID}" 2>/dev/null || true
  fi
  if [ -n "${APP_PID}" ] && kill -0 "${APP_PID}" 2>/dev/null; then
    log "🛑 Stopping app (PID ${APP_PID})…"
    kill "${APP_PID}" 2>/dev/null || true
  fi
}
trap cleanup INT TERM

# ------------------------- 1) start app --------------------------------------

log "🚀 Starting app: ${MVN_CMD}"
${MVN_CMD} &
APP_PID=$!

if ! wait_http_ok "${APP_URL}" 120; then
  log "❌ App did not become reachable at ${APP_URL}."
  cleanup
  exit 1
fi
log "✅ App is reachable."

# ------------------------- 2) start tunnel -----------------------------------

if [ ! -x "${TUNNEL_SCRIPT}" ]; then
  log "⚠️  Tunnel script not found or not executable: ${TUNNEL_SCRIPT}"
  log "    Tip: run 'chmod +x ${TUNNEL_SCRIPT}'"
fi

log "🔌 Starting tunnel via ${TUNNEL_SCRIPT} …"
: > "${CF_LOG}"
( bash "${TUNNEL_SCRIPT}" 2>&1 | tee -a "${CF_LOG}" ) &
TUNNEL_PID=$!

# ------------------------- 3) extract URL + wait DNS + HTTP ------------------

TUNNEL_URL=""
for _ in $(seq 1 60); do
  if grep -Eq 'https://[a-z0-9-]+\.trycloudflare\.com' "${CF_LOG}"; then
    TUNNEL_URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "${CF_LOG}" | head -n1)"
    break
  fi
  sleep 0.5
done

if [ -n "${TUNNEL_URL}" ]; then
  log "🌐 Tunnel URL detected: ${TUNNEL_URL}"

  # 3a) Wait for DNS to resolve before hitting HTTP (prevents noisy curl errors)
  TUNNEL_HOST="${TUNNEL_URL#https://}"; TUNNEL_HOST="${TUNNEL_HOST%%/*}"
  if wait_dns "${TUNNEL_HOST}" 90; then
    # 3b) One quiet HTTP readiness loop (bounded)
    if wait_http_ok "${TUNNEL_URL}" 60; then
      log "✅ Tunnel is live."
    else
      log "⚠️  Tunnel URL did not return HTTP 200 in time (may still warm up)."
    fi
  else
    log "⚠️  DNS did not resolve in time for ${TUNNEL_HOST}."
  fi

  if [ "${COPY_CLIPBOARD}" = "1" ]; then
    copy_clip "${TUNNEL_URL}" || true
    log "📋 Copied URL to clipboard."
  fi

  if [ "${OPEN_QR}" = "1" ]; then
    QR_URL="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${TUNNEL_URL}"
    if open_url "${QR_URL}"; then
      log "📱 Opened QR code in your default browser. Scan with iPhone."
    else
      log "⚠️  Could not auto-open QR code. QR link: ${QR_URL}"
    fi
  fi

  if [ "${OPEN_DESKTOP}" = "1" ]; then
    open_url "${TUNNEL_URL}" || true
  fi
else
  log "⚠️  Could not detect tunnel URL yet. Tunnel may still be starting."
  log "    Tip: run 'cloudflared tunnel --url http://localhost:8080' in PowerShell to verify."
fi

# ------------------------- 4) wait/hold --------------------------------------

log "   (Press Ctrl+C to stop the tunnel and the app)"
wait
