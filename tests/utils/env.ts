// tests/utils/env.ts
export const baseUrl =
  (process.env.EP_BASE_URL || process.env.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');

export function roomUrlFor(name: string, roomCode: string) {
  const u = new URL(baseUrl + '/room');
  u.searchParams.set('roomCode', roomCode);
  u.searchParams.set('participantName', name);
  return u.toString();
}

export function newRoomCode(prefix = 'E2E'): string {
  const rnd = Math.random().toString(36).slice(-4).toUpperCase();
  const t = Date.now().toString(36).toUpperCase();
  return `${prefix}-${t}-${rnd}`.replace(/[^A-Z0-9-]/g, '').slice(0, 24);
}
