// tests/prod-sanity.spec.js
import { test, expect } from '@playwright/test';
import { roomUrlFor, newRoomCode, ensureMenuOpen } from './_setup/prod-helpers.js';

test.describe('Prod sanity', () => {
  test('room loads, menu opens, core selectors exist', async ({ page }) => {
    const code = newRoomCode('SAN');
    await page.goto(roomUrlFor('SanityUser', code), { waitUntil: 'domcontentloaded' });

    // Basic app markers present
    await expect(page.locator('#cardGrid')).toHaveCount(1);
    await expect(page.locator('#liveParticipantList')).toHaveCount(1);

    // Menu opens and shows overlay
    await ensureMenuOpen(page);
    await expect(page.locator('#appMenuOverlay[aria-hidden="false"]')).toHaveCount(1);

    // Critical toggles exist in markup (host/guest visibility can vary, just assert presence if rendered)
    await expect(page.locator('#menuTopicToggle')).toHaveCount(1);
    await expect(page.locator('#menuParticipationToggle')).toHaveCount(1);

    // Auto-reveal might be hidden in certain roles; do not hard-fail if missing
    // (We assert it conditionally to keep prod smoke lenient.)
    const ar = page.locator('#menuAutoRevealToggle');
    if (await ar.count()) {
      await expect(ar).toHaveAttribute('role', 'switch');
    }
  });
});
