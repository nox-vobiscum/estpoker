// Sequence change E2E (host-only + resets round):
// - Host and guest join a room.
// - Both cast votes (pre-reveal), host sees ✓ status icons.
// - Host changes sequence via radio → round resets (✓ icons disappear).
// - Guest cannot change sequence (radios disabled); after host change, guest reflects new selection.
// - Card grid content changes to include T-Shirt sizes after switching to "tshirt".
//
// Run:
//   npx playwright test tests/sequence-change.spec.js

const { test, expect } = require('@playwright/test');

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() { return `SEQ-${Date.now().toString(36).slice(-6)}`; }
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

// Wait until card buttons are rendered
async function waitGridReady(page) {
  const grid = page.locator('#cardGrid');
  await expect(grid).toHaveCount(1);
  await page.waitForFunction(() => {
    const g = document.querySelector('#cardGrid');
    return !!g && g.querySelectorAll('button').length > 0;
  });
}

async function ensureMenuOpen(page) {
  const overlay = page.locator('#appMenuOverlay');
  if (!(await overlay.isVisible().catch(()=>false))) {
    await page.locator('#menuButton').click();
    await expect(overlay).toBeVisible();
  }
}
async function ensureMenuClosed(page) {
  const overlay = page.locator('#appMenuOverlay');
  if (await overlay.isVisible().catch(()=>false)) {
    await page.locator('#menuButton').click();
  }
}

// Click a numeric card by exact label (e.g. "3" or "8")
async function clickCardExact(page, label) {
  const byRole = page.getByRole('button', { name: label, exact: true });
  if (await byRole.count()) { await byRole.first().click(); return true; }
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byText = page.locator('button', { hasText: new RegExp(`^\\s*${esc}\\s*$`) });
  if (await byText.count()) { await byText.first().click(); return true; }
  return false;
}

// Read current selected sequence id from the menu (value of checked radio)
async function getSelectedSequenceId(page) {
  return await page.evaluate(() => {
    const sel = document.querySelector('#menuSeqChoice input[name="menu-seq"]:checked');
    return sel ? sel.value : null;
  });
}

// Wait until a radio is present and enabled (host controls ready)
async function waitRadioEnabled(page, value) {
  await page.waitForFunction((val) => {
    const el = document.querySelector(`#menuSeqChoice input[name="menu-seq"][value="${val}"]`);
    return !!el && !el.disabled;
  }, value, { timeout: 5000 });
}

test('Host-only sequence change resets round and syncs to guest', async ({ browser }) => {
  const roomCode = newRoomCode();

  // Host and guest contexts
  const ctxHost  = await browser.newContext();
  const ctxGuest = await browser.newContext();
  const host  = await ctxHost.newPage();
  const guest = await ctxGuest.newPage();

  // Join room (host first to acquire host role)
  await host.goto(roomUrlFor('Host', roomCode),  { waitUntil: 'domcontentloaded' });
  await guest.goto(roomUrlFor('Guest', roomCode), { waitUntil: 'domcontentloaded' });

  await waitGridReady(host);
  await waitGridReady(guest);

  // Both vote (pre-reveal): ensure ✓ status icons appear on host list
  expect(await clickCardExact(host, '8') || await clickCardExact(host, '5') || await clickCardExact(host, '3'))
    .toBeTruthy();
  expect(await clickCardExact(guest, '3') || await clickCardExact(guest, '5') || await clickCardExact(guest, '8'))
    .toBeTruthy();

  await host.waitForTimeout(150);
  const doneBefore = await host.locator('#liveParticipantList .status-icon.done').count();
  expect(doneBefore).toBeGreaterThan(0);

  // Open menu on both for assertions
  await ensureMenuOpen(host);
  await ensureMenuOpen(guest);

  // Guest radios should be disabled (non-host)
  const guestRadios = guest.locator('#menuSeqChoice input[name="menu-seq"]');
  await expect(guestRadios).toHaveCountGreaterThan(0);
  const guestDisabledFlags = await guestRadios.evaluateAll(list => list.map(el => el.disabled));
  expect(guestDisabledFlags.every(Boolean)).toBeTruthy();
  const initiallyCheckedOnGuest = await getSelectedSequenceId(guest);

  // Host: wait until the "tshirt" radio is truly enabled (host state established)
  const hostTshirtRadio = host.locator('#menuSeqChoice input[name="menu-seq"][value="tshirt"]');
  await expect(hostTshirtRadio).toHaveCount(1);
  await waitRadioEnabled(host, 'tshirt');

  // Change via .check() (more reliable than label click)
  await hostTshirtRadio.check({ force: true });
  await host.waitForTimeout(250); // WS roundtrip and reset

  // Round should be reset: ✓ icons gone on host list
  const doneAfter = await host.locator('#liveParticipantList .status-icon.done').count();
  expect(doneAfter).toBe(0);

  // Guest selection should sync to "tshirt"
  await guest.waitForTimeout(150);
  const selectedOnGuest = await getSelectedSequenceId(guest);
  expect(selectedOnGuest).toBe('tshirt');

  // Grid should now contain at least one T-Shirt size button (S / M / L / XL)
  const gridButtons = host.locator('#cardGrid button');
  const labels = (await gridButtons.allTextContents()).map(t => (t || '').trim());
  const hasTshirt = labels.some(t => ['S','M','L','XL','XXL'].includes(t));
  expect(hasTshirt).toBeTruthy();

  await ensureMenuClosed(host);
  await ensureMenuClosed(guest);

  await ctxHost.close(); await ctxGuest.close();
});

// Tiny matcher extension for nicer assertions
expect.extend({
  async toHaveCountGreaterThan(locator, min) {
    const count = await locator.count();
    if (count > min) return { pass: true, message: () => `expected count not to be > ${min}` };
    return { pass: false, message: () => `expected count > ${min} but got ${count}` };
  }
});
