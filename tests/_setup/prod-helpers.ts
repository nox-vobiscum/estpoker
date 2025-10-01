// tests/_setup/prod-helpers.ts
// Thin helpers used by “prod-*” specs. Delegate to ../utils/env + ../utils/helpers
// to avoid duplicate logic.

import { baseUrl, newRoomCode as mkCode, roomUrlFor as mkRoomUrl } from '../utils/env';
export { baseUrl };

// Keep the canonical generator (short prefix remains handy in screenshots)
export function newRoomCode(prefix: string = 'E2E'): string {
  return mkCode(prefix);
}

// Same as env.roomUrlFor but allows appending extra query params via `extra`
export function roomUrlFor(name: string, code: string, extra: string = ''): string {
  const u = new URL(mkRoomUrl(name, code));
  if (extra) {
    const qs = new URLSearchParams(extra.replace(/^[?&]/, ''));
    for (const [k, v] of qs) u.searchParams.set(k, v);
  }
  return u.toString();
}

// Re-use UI menu helpers from the shared helpers module
export { ensureMenuOpen, ensureMenuClosed } from '../utils/helpers';
