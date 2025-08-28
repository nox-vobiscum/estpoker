// Prod smoke: page loads, menu works, toggles exist, specials visible
// Runs against production via EP_BASE_URL / EP_ROOM_URL.

import { test, expect } from '@playwright/test';
import { roomUrlFor, newRoomCode, ensureMenuOpen, ensureMenuClosed } from './_setup/prod-helpers.js';

// Hard guard so we don't accidentally hit localhost.
test.beforeAll(() => {
  expect(process.env.EP_BASE_URL, 'EP_BASE_URL must be set (https://...)').toMatch(/^https?:\/\//);
  expect(process.env.EP_ROOM_URL, 'EP_ROOM_URL must be set (https://.../room)').toMatch(/^https?:\/\//);
});

test('Prod smoke: page loads and menu open/close', async ({ page }) => {
  const room = newRoomCode('PROD-SMOKE');
  await page.goto(roomUrlFor('Smoke', room), { waitUntil: 'domcontentloaded' });

  // Core UI present
  await expect(page.locator('#cardGrid')).toBeVisible();
  await expect(page.locator('#menuButton')).toBeVisible();

  // Menu toggles open/close reliably
  await ensureMenuOpen(page);
  await expect(page.locator('#appMenuOverlay[aria-hidden="false"]')).toBeVisible();

  await ensureMenuClosed(page);
  // Overlay element remains in DOM, but is hidden (display:none + aria-hidden)
  const overlay = page.locator('#appMenuOverlay');
  await expect(overlay).toHaveCount(1);
  await expect(overlay).toBeHidden();
  await expect(overlay).toHaveAttribute('aria-hidden', 'true');
});

test('Prod smoke: toggles exist and specials (❓ 💬 ☕) visible', async ({ page }) => {
  const room = newRoomCode('PROD-SMOKE2');
  await page.goto(roomUrlFor('Viewer', room), { waitUntil: 'domcontentloaded' });

  // Menu toggles exist
  await ensureMenuOpen(page);
  await expect(page.locator('#menuAutoRevealToggle')).toHaveCount(1);
  await expect(page.locator('#menuTopicToggle')).toHaveCount(1);
  await expect(page.locator('#menuParticipationToggle')).toHaveCount(1);
  await ensureMenuClosed(page);

  // Specials must be present as card buttons
  await expect(page.getByRole('button', { name: '❓', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '💬', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '☕',  exact: true })).toBeVisible();
});
