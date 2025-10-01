// tests/utils/env.ts
export function baseUrl(): string {
  return process.env.EP_BASE_URL || 'http://localhost:8080';
}

export function newRoomCode(prefix = 'E2E'): string {
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 1e6).toString(36);
  return `${prefix}-${t.slice(-4)}-${r.slice(-3)}`.toUpperCase();
}

export function roomUrlFor(name: string, roomCode: string): string {
  const full = process.env.EP_ROOM_URL;
  if (full) {
    const u = new URL(full);
    u.searchParams.set('participantName', name);
    u.searchParams.set('roomCode', roomCode);
    return u.toString();
  }
  const u = new URL(`${baseUrl().replace(/\/$/, '')}/room`);
  u.searchParams.set('participantName', name);
  u.searchParams.set('roomCode', roomCode);
  return u.toString();
}
