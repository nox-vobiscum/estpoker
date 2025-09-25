// Server includes specials in voteUpdate payload (and UI shows ❓ ☕)
// Speech bubble (💬) is intentionally removed.

import { test, expect } from '@playwright/test';
import { ensureMenuOpen, ensureMenuClosed } from './utils/helpers.js';

// Small local helper to avoid helper import mismatch
function uniqueRoom(prefix = 'SPECIALS') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

test('Server includes specials ❓ ☕ (no 💬) and UI shows them', async ({ page }) => {
  const room = uniqueRoom();

  // Hook WebSocket messages to capture the latest voteUpdate payload
  await page.addInitScript(() => {
    (window).__lastVoteUpdate = null;
    const NativeWS = window.WebSocket;
    window.WebSocket = function (url, protocols) {
      const ws = new NativeWS(url, protocols);
      ws.addEventListener('message', (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m && m.type === 'voteUpdate') {
            (window).__lastVoteUpdate = m;
          }
        } catch {}
      });
      return ws;
    };
    window.WebSocket.prototype = NativeWS.prototype;
    window.WebSocket.OPEN = NativeWS.OPEN;
  });

  await page.goto(`/room?roomCode=${encodeURIComponent(room)}&participantName=Amy`, {
    waitUntil: 'domcontentloaded'
  });

  // Wait until we have a voteUpdate captured and read specials
  const specials = await expect
    .poll(async () => {
      return await page.evaluate(() => (window).__lastVoteUpdate && (window).__lastVoteUpdate.specials);
    }, { timeout: 15000 })
    .not.toBeNull()
    .then(async () => await page.evaluate(() => (window).__lastVoteUpdate.specials));

  // Expect exactly the reduced set: ❓ and ☕ (💬 removed in codebase)
  expect(Array.isArray(specials)).toBeTruthy();
  expect(specials).toEqual(['❓', '☕']);

  // If there is a Specials toggle in the menu, ensure it's ON (host-only control)
  await ensureMenuOpen(page);
  const specialsToggle = page.locator('#menuSpecialsToggle, #menuAllowSpecialsToggle');
  if (await specialsToggle.count()) {
    if (!(await specialsToggle.isChecked())) {
      await specialsToggle.click({ force: true });
    }
  }
  await ensureMenuClosed(page);

  // UI must show ❓ and ☕ buttons in the grid; 💬 must NOT be present
  // Use text match inside #cardGrid to avoid ARIA name discrepancies.
  const grid = page.locator('#cardGrid');
  await expect(grid).toBeVisible();

  await expect(grid.locator('button:has-text("❓")')).toHaveCount(1, { timeout: 8000 });
  await expect(grid.locator('button:has-text("☕")')).toHaveCount(1, { timeout: 8000 });
  await expect(grid.locator('button:has-text("💬")')).toHaveCount(0);
});
