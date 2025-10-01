// tests/utils/helpers.ts
// Bridge module: re-export canonical ENV helpers and keep UI helpers here.

export { baseUrl, roomUrlFor, newRoomCode } from './env';

import type { Page } from '@playwright/test';

/**
 * Ensures the app menu is open. Uses aria-hidden instead of relying on CSS visibility.
 */
export async function ensureMenuOpen(page: Page): Promise<void> {
  const btn = page.locator('#menuButton');
  const overlay = page.locator('#appMenuOverlay');

  // If not open yet, toggle open
  const aria = await overlay.getAttribute('aria-hidden');
  if (aria !== 'false') {
    await btn.click();
  }

  // Wait until aria-hidden="false"
  await overlay.waitFor({ state: 'attached' });
  await page.waitForFunction(() => {
    const el = document.getElementById('appMenuOverlay');
    return !!el && el.getAttribute('aria-hidden') === 'false';
  });
}

/**
 * Ensures the app menu is closed. Prefer toggling via the button, attribute-based waiting.
 */
export async function ensureMenuClosed(page: Page): Promise<void> {
  const btn = page.locator('#menuButton');
  const overlay = page.locator('#appMenuOverlay');

  await overlay.waitFor({ state: 'attached' });

  const isOpen = (await overlay.getAttribute('aria-hidden')) === 'false';
  if (isOpen) {
    await btn.click();
  }

  // Wait until aria-hidden="true"
  await page.waitForFunction(() => {
    const el = document.getElementById('appMenuOverlay');
    return !!el && el.getAttribute('aria-hidden') === 'true';
  });

  // Best-effort: in many builds the 'hidden' class returns as well
  await page.waitForFunction(() => {
    const el = document.getElementById('appMenuOverlay');
    return !!el && el.classList.contains('hidden');
  }).catch(() => { /* optional; not all builds add the class */ });
}
