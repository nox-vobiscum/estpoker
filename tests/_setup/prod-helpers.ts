// tests/_setup/prod-helpers.js
// Resolve base/room URLs from env for running E2E against prod.
// Fallbacks keep localhost working if env vars are absent.

import { test, expect, Page, Browser } from '@playwright/test';

export const HOST = process.env.EP_BASE_URL || 'http://localhost:8080';
export const ROOM_URL_BASE = process.env.EP_ROOM_URL || `${HOST}/room`;

export function roomUrlFor(name, code, extra = '') {
  const qp = new URLSearchParams({ participantName: name, roomCode: code });
  const tail = extra ? `&${extra.replace(/^\?/, '')}` : '';
  return `${ROOM_URL_BASE}?${qp.toString()}${tail}`;
}

export function newRoomCode(prefix = 'E2E') {
  const rnd = Math.random().toString(36).slice(-5);
  return `${prefix}-${rnd}`;
}

export async function ensureMenuOpen(page) {
  const overlay = page.locator('#appMenuOverlay');
  // Toggle open if not open yet
  const aria = await overlay.getAttribute('aria-hidden');
  if (aria !== 'false') {
    await page.locator('#menuButton').click();
  }
  // Wait for "open" state by attribute (do NOT require visible class-wise)
  await expect(overlay).toHaveAttribute('aria-hidden', 'false');
}

export async function ensureMenuClosed(page) {
  const overlay = page.locator('#appMenuOverlay');
  await expect(overlay).toHaveCount(1); // fragment should exist

  const aria = await overlay.getAttribute('aria-hidden');
  const isOpen = aria === 'false';

  if (isOpen) {
    // Use the button to close (more robust than backdrop in some layouts)
    await page.locator('#menuButton').click();
  }

  // Wait for "closed" state by attribute (do NOT wait for visibility)
  await expect(overlay).toHaveAttribute('aria-hidden', 'true');

  // And best-effort: wait until the hidden class is back (defensive)
  await page.waitForFunction(() => {
    const el = document.getElementById('appMenuOverlay');
    return !!el && el.getAttribute('aria-hidden') === 'true' && el.classList.contains('hidden');
  });
}
