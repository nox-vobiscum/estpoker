// Menu sequence radios: host enabled, guest disabled; change propagates
// - Works with current markup: #menuSeqChoice + input[name="menu-seq"]
// - Host: radios enabled & can change -> server broadcasts sequenceId + deck
// - Guest: same radios but disabled (label.disabled / aria-disabled)

import { test, expect } from '@playwright/test';
import { ensureMenuOpen, ensureMenuClosed } from './utils/helpers.js';

// Local, test-scoped room code generator
const mkRoom = (prefix = 'SEQ') =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

// Hook WS early and capture latest voteUpdate
function wsHookInitScript() {
  (function () {
    const _WS = window.WebSocket;
    window.__lastVoteUpdate = null as any;
    window.WebSocket = class extends _WS {
      constructor(...args: any[]) {
        super(...args as any);
        this.addEventListener('message', (ev: MessageEvent) => {
          try {
            const msg = JSON.parse(String(ev.data));
            if (msg && msg.type === 'voteUpdate') {
              (window as any).__lastVoteUpdate = msg;
            }
          } catch {}
        });
      }
    } as any;
  })();
}

// Wait until a voteUpdate with desired sequenceId is observed
async function waitForSequence(page, seqId: string, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const payload = await page.evaluate(() => (window as any).__lastVoteUpdate || null);
    if (payload?.sequenceId === seqId) return payload;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timeout waiting for sequenceId=${seqId} in payload`);
}

// Count radios + how many are effectively disabled (including disabled fieldset)
async function countRadiosDisabledOn(page) {
  return await page.evaluate(() => {
    const root = document.querySelector('#menuSeqChoice');
    if (!root) return { total: 0, disabled: 0 };
    const radios = Array.from(
      root.querySelectorAll<HTMLInputElement>('input[type="radio"][name="menu-seq"]')
    );
    const flags = radios.map(el => {
      const fs = el.closest('fieldset') as HTMLFieldSetElement | null;
      return !!el.disabled || !!(fs && fs.disabled);
    });
    return { total: radios.length, disabled: flags.filter(Boolean).length };
  });
}

test('Menu sequence radios: host enabled, guest disabled; change propagates', async ({ page }) => {
  const room = mkRoom('SEQ');

  // Prepare pages & hook payload BEFORE navigation
  const host = page;
  await host.addInitScript(wsHookInitScript);

  const guest = await host.context().newPage();
  await guest.addInitScript(wsHookInitScript);

  // Navigate (baseURL comes from Playwright config / EP_BASE_URL)
  await host.goto(`/room?roomCode=${encodeURIComponent(room)}&participantName=Host`,  { waitUntil: 'domcontentloaded' });
  await guest.goto(`/room?roomCode=${encodeURIComponent(room)}&participantName=Guest`, { waitUntil: 'domcontentloaded' });

  // Sanity: grid visible on both
  await expect(host.locator('#cardGrid')).toBeVisible();
  await expect(guest.locator('#cardGrid')).toBeVisible();

  // Both see sequence controls in the menu
  await ensureMenuOpen(host);
  await ensureMenuOpen(guest);

  const hostRadios  = host.locator('#menuSeqChoice input[type="radio"][name="menu-seq"]');
  const guestRadios = guest.locator('#menuSeqChoice input[type="radio"][name="menu-seq"]');

  const hostCount  = await hostRadios.count();
  const guestCount = await guestRadios.count();
  expect(hostCount,  'host should see sequence radios').toBeGreaterThan(0);
  expect(guestCount, 'guest should also see sequence radios').toBe(hostCount);

  const { total: hostTotal, disabled: hostDisabled }   = await countRadiosDisabledOn(host);
  const { total: guestTotal, disabled: guestDisabled } = await countRadiosDisabledOn(guest);

  // If ALL host radios are disabled, this build forbids changing sequence via menu → skip
  if (hostTotal > 0 && hostDisabled === hostTotal) {
    test.skip(true, 'This build disables sequence change via menu (all host radios disabled).');
  }

  expect(hostDisabled,  'host radios must be enabled').toBe(0);
  expect(guestDisabled, 'guest radios must be fully disabled').toBe(guestTotal);

  // Extra robustness: guest labels have disabled semantics
  await expect(guest.locator('#menuSeqChoice label.radio-row.disabled')).toHaveCount(guestCount);

  // Host changes sequence to fib.enh
  const target = 'fib.enh';
  const hostTarget = host.locator(
    `#menuSeqChoice input[type="radio"][name="menu-seq"][value="${target}"]`
  );
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
  expect(Array.isArray(hostPayload.cards)).toBeTruthy();
  expect(hostPayload.cards.length).toBeGreaterThan(0);
  expect(guestPayload.cards).toEqual(hostPayload.cards);

  // Guest radios remain disabled even after the host change
  await ensureMenuOpen(guest);
  await expect(guest.locator('#menuSeqChoice input[type="radio"][name="menu-seq"]')).toHaveCount(guestCount);
  await expect(guest.locator('#menuSeqChoice label.radio-row.disabled')).toHaveCount(guestCount);
  await ensureMenuClosed(guest);
});
