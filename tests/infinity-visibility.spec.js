// ∞ is visible only for "fib.enh" and hidden for others
// We validate via the server's voteUpdate payload (payload.cards), which is the source of truth.
// DOM can vary in glyph/markup; payload must be correct per CardSequences.java.

import { test, expect } from '@playwright/test';

// Local room code generator (no external helpers needed)
function newRoomCode(prefix = 'INF') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// Dispatch the app's host-only sequence-change event
async function selectSequenceViaEvent(page, seqId) {
  await page.evaluate((id) => {
    window.dispatchEvent(new CustomEvent('ep:sequence-change', { detail: { sequenceId: id } }));
  }, seqId);
}

// Return the latest voteUpdate payload captured in the page
async function getLastPayload(page) {
  return await page.evaluate(() => window.__lastVoteUpdate || null);
}

// Wait until the payload reports the requested sequenceId (or timeout)
async function waitForSequence(page, seqId, timeout = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const p = await getLastPayload(page);
    if (p && p.sequenceId === seqId) return p;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timeout waiting for sequenceId=${seqId} in payload`);
}

// Helper: detect infinity in payload cards (supports common glyphs)
function hasInfinity(cards) {
  if (!Array.isArray(cards)) return false;
  return cards.some((c) => typeof c === 'string' && (c.includes('∞') || c.includes('♾')));
}

test('∞ is visible only for "fib.enh" and hidden for others', async ({ page }) => {
  const room = newRoomCode('INF');

  // Hook WebSocket messages to capture the latest voteUpdate payload in window.__lastVoteUpdate
  await page.addInitScript(() => {
    (function () {
      const _send = WebSocket.prototype.send;
      WebSocket.prototype.send = function (...args) {
        if (!this.__hooked) {
          this.__hooked = true;
          this.addEventListener('message', (ev) => {
            try {
              const data = JSON.parse(ev.data);
              if (data && data.type === 'voteUpdate') {
                window.__lastVoteUpdate = data;
              }
            } catch {}
          });
        }
        return _send.apply(this, args);
      };
    })();
  });

  await page.goto(`/room?roomCode=${encodeURIComponent(room)}&participantName=Alex`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('#cardGrid')).toBeVisible();

  // Sanity: Wait for first payload (initial sequence)
  let payload = await waitForSequence(page, (await getLastPayload(page))?.sequenceId || 'fib.scrum').catch(async () => {
    // If initial seq unknown, just wait for any first payload
    const start = Date.now();
    while (Date.now() - start < 10_000) {
      const p = await getLastPayload(page);
      if (p) { payload = p; break; }
      await page.waitForTimeout(100);
    }
    if (!payload) throw new Error('No initial voteUpdate payload received');
    return payload;
  });

  // 1) fib.scrum → NO infinity
  await selectSequenceViaEvent(page, 'fib.scrum');
  payload = await waitForSequence(page, 'fib.scrum');
  expect(Array.isArray(payload.cards)).toBeTruthy();
  expect(hasInfinity(payload.cards)).toBe(false);

  // 2) fib.enh → YES infinity
  await selectSequenceViaEvent(page, 'fib.enh');
  payload = await waitForSequence(page, 'fib.enh');
  expect(Array.isArray(payload.cards)).toBeTruthy();
  expect(hasInfinity(payload.cards)).toBe(true);

  // 3) pow2 → NO infinity
  await selectSequenceViaEvent(page, 'pow2');
  payload = await waitForSequence(page, 'pow2');
  expect(Array.isArray(payload.cards)).toBeTruthy();
  expect(hasInfinity(payload.cards)).toBe(false);
});
