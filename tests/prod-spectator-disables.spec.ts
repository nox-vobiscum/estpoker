// Prod-friendly check: observer toggle disables/enables the user's card buttons.
// Keeps assertions purely DOM-based (no reliance on internal events).

import { test, expect, Page, Browser } from '@playwright/test';
import {
  roomUrlFor,
  newRoomCode,
  ensureMenuOpen,
  ensureMenuClosed,
} from './_setup/prod-helpers.js';

async function countEnabledButtons(p) {
  const total = await p.locator('#cardGrid button').count();
  const enabled = await p.locator('#cardGrid button:enabled').count();
  return { total, enabled };
}

test('Observer toggle disables/enables card buttons on user client (prod-safe)', async ({ page, browser }) => {
  const roomCode = newRoomCode('PROD-OBS');
  const host = page;
  const user = await browser.newPage();

  // Open host + user into same room
  await host.goto(roomUrlFor('Host', roomCode), { waitUntil: 'domcontentloaded' });
  await user.goto(roomUrlFor('Viewer', roomCode), { waitUntil: 'domcontentloaded' });

  // Ensure grids are visible
  await expect(host.locator('#cardGrid')).toBeVisible();
  await expect(user.locator('#cardGrid')).toBeVisible();

  // Initially user should be "estimating": expect some enabled cards
  const before = await countEnabledButtons(user);
  expect(before.total).toBeGreaterThan(0);
  expect(before.enabled).toBeGreaterThan(0);

  // Open menu, toggle participation OFF (become observer), close menu
  await ensureMenuOpen(user);
  const partToggle = user.locator('#menuParticipationToggle');
  await expect(partToggle).toHaveCount(1);
  // Force state to unchecked (= observer)
  const initiallyChecked = await partToggle.isChecked();
  if (initiallyChecked) {
    // setChecked triggers the 'change' event on real inputs
    await partToggle.setChecked(false);
  } else {
    // already unchecked — still click to fire any listeners
    await partToggle.click({ force: true });
  }
  await ensureMenuClosed(user);

  // Wait until all buttons become disabled (allow WS/DOM roundtrip)
  await user.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('#cardGrid button'));
    return btns.length > 0 && btns.every(b => b.disabled === true);
  });
  const afterOff = await countEnabledButtons(user);
  expect(afterOff.enabled).toBe(0);

  // Toggle participation ON (back to estimating)
  await ensureMenuOpen(user);
  if (!await partToggle.isChecked()) {
    await partToggle.setChecked(true);
  } else {
    await partToggle.click({ force: true });
  }
  await ensureMenuClosed(user);

  // Wait until at least one button is enabled again
  await user.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('#cardGrid button'));
    return btns.length > 0 && btns.some(b => b.disabled === false);
  });
  const afterOn = await countEnabledButtons(user);
  expect(afterOn.enabled).toBeGreaterThan(0);
});
