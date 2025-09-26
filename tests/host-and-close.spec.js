// Host actions: "Make host" & "Close room" must show confirm dialogs.
// Run: npx playwright test tests/host-and-close.spec.js
const { test, expect } = require('@playwright/test');

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() { return `HOST-${Date.now().toString(36).slice(-6)}`; }
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

test.describe('Host actions: transfer & close room', () => {
  test('Make host shows a confirm dialog (en/de) with target name', async ({ browser }) => {
    const roomCode = newRoomCode();
    const hostName = 'Alice';
    const guestNameFallback = 'Bob';

    const ctxHost = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host = await ctxHost.newPage();
    const guest = await ctxGuest.newPage();

    await host.goto(roomUrlFor(hostName, roomCode), { waitUntil: 'domcontentloaded' });
    await guest.goto(roomUrlFor(guestNameFallback, roomCode), { waitUntil: 'domcontentloaded' });

    // Warten bis der "Make host"-Button für IRGENDEINE Fremdzeile sichtbar ist
    const makeHostBtn = host.locator('button.row-action.host').first();
    await expect(makeHostBtn).toBeVisible({ timeout: 15000 });

    // Namen aus derselben Zeile lesen (fallback auf Bob)
    const nameEl = makeHostBtn.locator(
      'xpath=ancestor::*[contains(@class,"participant-row") or contains(@class,"p-row")]//span[contains(@class,"name") or contains(@class,"p-name")]'
    );
    const targetName = ((await nameEl.textContent().catch(() => '')) || '').trim() || guestNameFallback;

    let confirmMsg = '';
    host.once('dialog', async (d) => { confirmMsg = d.message(); await d.accept(); });

    await makeHostBtn.click();

    expect(confirmMsg, 'Confirm dialog not shown').toBeTruthy();
    const re = new RegExp(
      `^(Transfer\\s+host\\s+role\\s+to\\s+${targetName}\\?|Host-Rolle\\s+an\\s+${targetName}\\s+übertragen\\?)$`
    );
    expect(re.test(confirmMsg)).toBeTruthy();

    await ctxHost.close(); await ctxGuest.close();
  });

  test('Close room (menu) shows a confirm dialog (en/de)', async ({ browser }) => {
    const roomCode = newRoomCode();
    const hostName = 'Carol';
    const guestName = 'Dave';

    const ctxHost = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host = await ctxHost.newPage();
    const guest = await ctxGuest.newPage();

    await host.goto(roomUrlFor(hostName, roomCode), { waitUntil: 'domcontentloaded' });
    await guest.goto(roomUrlFor(guestName, roomCode), { waitUntil: 'domcontentloaded' });

    await ensureMenuOpen(host);

    const closeBtn = host.locator('#closeRoomBtn');
    if ((await closeBtn.count()) === 0) test.skip(true, 'closeRoomBtn not present in this build/view');

    let confirmMsg = '';
    host.once('dialog', async (d) => { confirmMsg = d.message(); await d.accept(); });
    await closeBtn.click();

    expect(confirmMsg, 'Confirm dialog not shown').toBeTruthy();
    const re = /^(Close this room for everyone\?|Diesen Raum für alle schließen\?)$/;
    expect(re.test(confirmMsg)).toBeTruthy();

    await ctxHost.close(); await ctxGuest.close();
  });
});
