// Host actions: "Make host" & "Close room" must show confirm dialogs.
// We assert the confirm text (en/de) and accept it.
// Run:
//   npx playwright test tests/host-and-close.spec.js
// Env:
//   EP_BASE_URL (e.g. http://localhost:8080 or https://ep.noxvobiscum.at)
//   EP_ROOM_URL (optional full room URL; overrides base; test appends participant & room)

const { test, expect } = require('@playwright/test');

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() {
  const t = Date.now().toString(36).slice(-6);
  return `HOST-${t}`;
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

test.describe('Host actions: transfer & close room', () => {
  test('Make host shows a confirm dialog (en/de) with target name', async ({ browser }) => {
    const roomCode = newRoomCode();
    const hostName = 'Alice';
    const guestName = 'Bob';

    // Host first → becomes host; guest joins second
    const ctxHost = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host = await ctxHost.newPage();
    const guest = await ctxGuest.newPage();

    await host.goto(roomUrlFor(hostName, roomCode), { waitUntil: 'domcontentloaded' });
    await guest.goto(roomUrlFor(guestName, roomCode), { waitUntil: 'domcontentloaded' });

    // Wait until both participants are listed
    await host.waitForFunction(() => {
      return document.querySelectorAll('#liveParticipantList .participant-row').length >= 2;
    });

    // Find the row for the guest on the host page
    const row = host.locator('#liveParticipantList .participant-row', { hasText: guestName });
    await expect(row).toHaveCount(1);

    // The "Make host" button is only visible to the host
    const makeHostBtn = row.locator('button.row-action.host');
    await expect(makeHostBtn).toBeVisible();

    // Capture & accept confirm dialog; assert its message (en or de)
    let confirmMsg = '';
    host.once('dialog', async (d) => {
      confirmMsg = d.message();
      await d.accept();
    });

    await makeHostBtn.click();

    expect(confirmMsg, 'Confirm dialog not shown').toBeTruthy();
    const re = new RegExp(
      `^(Make\\s+${guestName}\\s+the\\s+host\\?|Host-Rolle\\s+an\\s+${guestName}\\s+übergeben\\?)$`
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

    // Open menu on host
    await ensureMenuOpen(host);

    const closeBtn = host.locator('#closeRoomBtn');
    const exists = await closeBtn.count();
    if (exists === 0) {
      test.skip(true, 'closeRoomBtn not present in this build/view (fragment flag showRoom?)');
    }

    // Capture & accept confirm dialog; assert message text (en or de)
    let confirmMsg = '';
    host.once('dialog', async (d) => {
      confirmMsg = d.message();
      await d.accept();
    });

    await closeBtn.click();

    expect(confirmMsg, 'Confirm dialog not shown').toBeTruthy();
    const re = /^(Close this room for everyone\?|Diesen Raum für alle schließen\?)$/;
    expect(re.test(confirmMsg)).toBeTruthy();

    // Optional (best-effort): guest might be redirected/WS-closed by server
    // We don't assert server effects to keep test robust across environments.

    await ctxHost.close(); await ctxGuest.close();
  });
});
