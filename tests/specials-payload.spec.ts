// Server includes specials in voteUpdate payload (and UI shows ❓ ☕)
// Only coffee is selected; the question card is always added by the client.

import { test, expect, Page, Browser } from '@playwright/test';
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

  await expect(page.locator('#liveParticipantList .host-label')).toHaveCount(1);
  await ensureMenuOpen(page);
  await page.locator('#menuSpecialsToggle').check();
  await page.locator('#rowSpecialsPick .spc[data-id="coffee"]').click();
  await ensureMenuClosed(page);

  // Wait for the selected coffee card to be echoed by the server.
  const specials = await expect
    .poll(async () => {
      return await page.evaluate(() => (window).__lastVoteUpdate && (window).__lastVoteUpdate.specials);
    }, { timeout: 15000 })
    .toEqual(['☕'])
    .then(async () => await page.evaluate(() => (window).__lastVoteUpdate.specials));

  // The payload contains selected extras, not the always-present question card.
  expect(Array.isArray(specials)).toBeTruthy();
  expect(specials).toEqual(['☕']);

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
