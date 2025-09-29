// Menu sequence radios: host enabled, guest disabled; change propagates
// - Works with your current markup: #menuSeqChoice + input[name="menu-seq"]
// - Host: radios enabled & can change -> server broadcasts sequenceId + deck
// - Guest: sees same radios but disabled (label.disabled / aria-disabled)

import { test, expect } from '@playwright/test';
import { ensureMenuOpen, ensureMenuClosed } from './utils/helpers.js';

// Local, test-scoped room code generator (avoids helper export drift)
const mkRoom = (prefix = 'SEQ') =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

function wsHookInitScript() {
  // Capture latest voteUpdate payload early (before any WS connects)
  (function () {
    const _WS = window.WebSocket;
    window.__lastVoteUpdate = null;
    window.WebSocket = class extends _WS {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg && msg.type === 'voteUpdate') {
              window.__lastVoteUpdate = msg;
            }
          } catch {}
        });
      }
    };
  })();
}

// Wait until a voteUpdate with desired sequenceId is observed
async function waitForSequence(page, seqId, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const payload = await page.evaluate(() => window.__lastVoteUpdate || null);
    if (payload?.sequenceId === seqId) return payload;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timeout waiting for sequenceId=${seqId} in payload`);
}

// Count disabled radios on a page
async function countDisabledRadios(page) {
  return await page.evaluate(() => {
    const root = document.querySelector('#menuSeqChoice');
    if (!root) return -1;
    return Array.from(root.querySelectorAll('input[type="radio"][name="menu-seq"]'))
      .filter((r) => r.disabled).length;
  });
}

test('Menu sequence radios: host enabled, guest disabled; change propagates', async ({ page }) => {
  const room = mkRoom('SEQ');

  // Prepare pages & hook payload BEFORE navigation
  const host = page;
  await host.addInitScript(wsHookInitScript);

  const guest = await host.context().newPage();
  await guest.addInitScript(wsHookInitScript);

  // Navigate
  await host.goto(`/room?roomCode=${encodeURIComponent(room)}&participantName=Host`, { waitUntil: 'domcontentloaded' });
  await guest.goto(`/room?roomCode=${encodeURIComponent(room)}&participantName=Guest`, { waitUntil: 'domcontentloaded' });

  // Sanity: grid visible on both
  await expect(host.locator('#cardGrid')).toBeVisible();
  await expect(guest.locator('#cardGrid')).toBeVisible();

  // --- Both see sequence controls in the menu ---
  await ensureMenuOpen(host);
  await ensureMenuOpen(guest);

  const hostRadios  = host.locator('#menuSeqChoice input[type="radio"][name="menu-seq"]');
  const guestRadios = guest.locator('#menuSeqChoice input[type="radio"][name="menu-seq"]');

  // Ensure radios exist
  const hostCount  = await hostRadios.count();
  const guestCount = await guestRadios.count();
  expect(hostCount,  'host should see sequence radios').toBeGreaterThan(0);
  expect(guestCount, 'guest should also see sequence radios').toBe(hostCount);

  // Host radios should be enabled; Guest radios disabled (+ label.disabled / aria-disabled)
  const hostDisabled  = await countDisabledRadios(host);
  const guestDisabled = await countDisabledRadios(guest);
  expect(hostDisabled,  'host radios must be enabled').toBe(0);
  expect(guestDisabled, 'guest radios must be fully disabled').toBe(guestCount);

  // Extra robustness: guest labels have disabled semantics
  await expect(guest.locator('#menuSeqChoice label.radio-row.disabled')).toHaveCount(guestCount);

  // --- Host changes sequence to fib.enh ---
  const target = 'fib.enh';
  const hostTarget = host.locator(`#menuSeqChoice input[type="radio"][name="menu-seq"][value="${target}"]`);
  await expect(hostTarget, `host should see radio ${target}`).toHaveCount(1);
  expect(await hostTarget.isDisabled(), 'host target radio should be enabled').toBeFalsy();

  await hostTarget.check({ force: true });
  await ensureMenuClosed(host);
  await ensureMenuClosed(guest);

  // Wait for server broadcast on both clients
  const hostPayload  = await waitForSequence(host, target);
  const guestPayload = await waitForSequence(guest, target);

  // Assert payload structure reflects the change
  expect(hostPayload.sequenceId).toBe(target);
  expect(guestPayload.sequenceId).toBe(target);

  // Cards should be a non-empty array and identical for guest
  expect(Array.isArray(hostPayload.cards)).toBeTruthy();
  expect(hostPayload.cards.length).toBeGreaterThan(0);
  expect(guestPayload.cards).toEqual(hostPayload.cards);

  // Guest radios remain disabled even after the host change
  await ensureMenuOpen(guest);
  await expect(guest.locator('#menuSeqChoice input[type="radio"][name="menu-seq"]')).toHaveCount(guestCount);
  await expect(guest.locator('#menuSeqChoice label.radio-row.disabled')).toHaveCount(guestCount);
  await ensureMenuClosed(guest);
});
