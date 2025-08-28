// Verifies that backend includes `specials` in the `voteUpdate` payload
// and that the UI renders those special cards.
//
// Run: npx playwright test tests/specials-payload.spec.js

const { test, expect } = require('@playwright/test');

const BASE = process.env.EP_BASE_URL || 'http://localhost:8080';
const roomUrlFor = (name, code) =>
  `${BASE}/room?participantName=${encodeURIComponent(name)}&roomCode=${encodeURIComponent(code)}`;
const newRoomCode = (prefix = 'SPEC') =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

test('Server includes specials in voteUpdate payload (and UI shows ❓ 💬 ☕)', async ({ page }) => {
  // Intercept WS messages before app scripts run: capture latest voteUpdate.
  await page.addInitScript(() => {
    const NativeWS = window.WebSocket;
    window.__epWSMessages = [];
    window.__epLastVoteUpdate = null;

    window.WebSocket = new Proxy(NativeWS, {
      construct(target, args) {
        const ws = new target(...args);
        ws.addEventListener('message', (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg && msg.type === 'voteUpdate') {
              window.__epLastVoteUpdate = msg;
              window.__epWSMessages.push(msg);
            }
          } catch (_) {}
        });
        return ws;
      }
    });
  });

  const code = newRoomCode();
  await page.goto(roomUrlFor('SpecUser', code), { waitUntil: 'domcontentloaded' });

  // Wait until the first voteUpdate with specials arrives
  await page.waitForFunction(() =>
    !!window.__epLastVoteUpdate &&
    Array.isArray(window.__epLastVoteUpdate.specials) &&
    window.__epLastVoteUpdate.specials.length > 0
  );

  const specials = await page.evaluate(() => window.__epLastVoteUpdate.specials);
  expect(Array.isArray(specials)).toBeTruthy();
  // Exact set expected from CardSequences.SPECIALS
  expect(specials).toEqual(['❓','💬','☕']);

  // Sanity: UI must show those buttons (exact labels)
  await expect(page.getByRole('button', { name: '❓', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '💬', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '☕', exact: true })).toBeVisible();
});
