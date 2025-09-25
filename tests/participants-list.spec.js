// tests/participants-list.spec.js
// Initial participant list shows current user without needing a manual refresh.
// Robust: asserts user's row is present and a first voteUpdate arrived.

import { test, expect } from '@playwright/test';

// Local helper to avoid cross-file export mismatches
function newRoomCode(prefix = 'LIST') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

test('Initial participant list shows current user without refresh', async ({ page }) => {
  const room = newRoomCode('LIST');
  const user = 'Zoe';

  // Hook latest voteUpdate payload for a non-brittle sanity check
  await page.addInitScript(() => {
    (function () {
      const NativeWS = window.WebSocket;
      window.__lastVoteUpdate = null;
      window.WebSocket = function (url, protocols) {
        const ws = new NativeWS(url, protocols);
        ws.addEventListener('message', (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data && data.type === 'voteUpdate') {
              window.__lastVoteUpdate = data;
            }
          } catch {}
        });
        return ws;
      };
      window.WebSocket.prototype = NativeWS.prototype;
    })();
  });

  // Join the room directly
  await page.goto(`/room?roomCode=${encodeURIComponent(room)}&participantName=${encodeURIComponent(user)}`, {
    waitUntil: 'domcontentloaded',
  });

  // Participant list should render
  const list = page.locator('#liveParticipantList');
  await expect(list).toBeVisible();

  // The user's row should appear (exact name match if possible)
  const userRow = list.locator('.participant-row', { hasText: user }).first();
  await expect(userRow).toHaveCount(1);

  // If the "youName" badge is present, it should match the user name
  const youName = page.locator('#youName');
  if (await youName.count()) {
    await expect(youName).toHaveText(user);
  }

  // Best-effort payload sanity: a voteUpdate should have arrived
  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const p = window.__lastVoteUpdate;
          return !!(p && Array.isArray(p.participants) && p.participants.length >= 1);
        }),
      { timeout: 10_000 }
    )
    .toBe(true);
});
