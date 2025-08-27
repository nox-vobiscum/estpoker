// Sequence radios: host-only enablement and ep:sequence-change event dispatch
// Run:
//   npx playwright test tests/menu-sequence.spec.js
// Env:
//   EP_BASE_URL  (e.g. http://localhost:8080 or https://ep.noxvobiscum.at)
//   EP_ROOM_URL  (optional full room URL; overrides base; test appends participant & room)

const { test, expect } = require('@playwright/test');

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() {
  const t = Date.now().toString(36).slice(-6);
  return `SEQ-${t}`;
}
function roomUrlFor(name, roomCode) {
  const full = process.env.EP_ROOM_URL;
  if (full) {
    const u = new URL(full);
    u.searchParams.set('participantName', name);
    u.searchParams.set('roomCode', roomCode);
    return u.toString();
  }
  const u = new URL(`${baseUrl().replace(/\/$/,'')}/room`);
  u.searchParams.set('participantName', name);
  u.searchParams.set('roomCode', roomCode);
  return u.toString();
}

async function ensureMenuOpen(page) {
  const overlay = page.locator('#appMenuOverlay');
  if (!(await overlay.isVisible().catch(() => false))) {
    await page.locator('#menuButton').click();
    await expect(overlay).toBeVisible();
  }
}

async function attachSequenceRecorder(page) {
  await page.evaluate(() => {
    window.__epE2E_seqEvents = [];
    document.addEventListener('ep:sequence-change', (ev) => {
      const id = ev?.detail?.id ?? null;
      window.__epE2E_seqEvents.push({ id });
    });
  });
}
async function waitForSeqEvent(page) {
  await page.waitForFunction(() => Array.isArray(window.__epE2E_seqEvents) && window.__epE2E_seqEvents.length > 0);
  return page.evaluate(() => window.__epE2E_seqEvents[0]);
}

test.describe('Menu sequence radios', () => {
  test('host sees enabled radios and dispatches ep:sequence-change on selection; guest radios disabled', async ({ browser }) => {
    const roomCode = newRoomCode();

    // Host first → becomes host; Guest joins second
    const ctxHost = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host = await ctxHost.newPage();
    const guest = await ctxGuest.newPage();

    await host.goto(roomUrlFor('Hoster', roomCode), { waitUntil: 'domcontentloaded' });
    await guest.goto(roomUrlFor('Guest', roomCode), { waitUntil: 'domcontentloaded' });

    // --- Guest: radios should be disabled (host-only control) ---
    await ensureMenuOpen(guest);
    const guestRadios = guest.locator('#menuSeqChoice input[type="radio"][name="menu-seq"]');
    const guestCount = await guestRadios.count();
    if (guestCount > 0) {
      // allow a short grace in case the disable state is applied after initial WS sync
      await guest.waitForTimeout(150);
      // All radios should be disabled for guest
      for (let i = 0; i < guestCount; i++) {
        const dis = await guestRadios.nth(i).isDisabled();
        expect(dis).toBeTruthy();
      }
    }
    // close menu to avoid overlay intercepts later
    await guest.locator('#menuButton').click();
    await expect(guest.locator('#appMenuOverlay')).toBeHidden();

    // --- Host: radios enabled, changing selection dispatches ep:sequence-change ---
    await ensureMenuOpen(host);
    await attachSequenceRecorder(host);

    const hostRadios = host.locator('#menuSeqChoice input[type="radio"][name="menu-seq"]');
    const total = await hostRadios.count();
    expect(total).toBeGreaterThan(0);

    // Find current selection (0 or 1 checked); pick a different one if possible
    let currentIndex = -1;
    for (let i = 0; i < total; i++) {
      if (await hostRadios.nth(i).isChecked()) { currentIndex = i; break; }
    }
    // Choose a target index (prefer a different radio if available)
    const targetIndex = (currentIndex === -1) ? 0 : ((currentIndex + 1) % total);

    // Radios should be enabled for the host
    const enabled = !(await hostRadios.nth(targetIndex).isDisabled());
    expect(enabled).toBeTruthy();

    // Capture the value (sequence id) and click it
    const targetValue = await hostRadios.nth(targetIndex).getAttribute('value');
    await hostRadios.nth(targetIndex).click({ force: true });

    // Wait for ep:sequence-change and verify detail.id matches the clicked value
    const ev = await waitForSeqEvent(host);
    expect(ev && ev.id).toBeTruthy();
    expect(ev.id).toBe(targetValue);

    // Close overlay
    await host.locator('#menuButton').click();
    await expect(host.locator('#appMenuOverlay')).toBeHidden();

    await ctxHost.close(); await ctxGuest.close();
  });
});
