// Kick flow E2E:
// - Host sees "Kick" for another participant
// - Clicking it shows a confirm() dialog (English or German) with the user's name
// - After accepting, the kicked participant leaves the /room view (redirect or any navigation)
// Run:
//   npx playwright test tests/kick-flow.spec.js
// Env:
//   EP_BASE_URL  (e.g. http://localhost:8080 or https://ep.noxvobiscum.at)
//   EP_ROOM_URL  (optional full room URL; overrides base; test appends participant & room)

const { test, expect } = require('@playwright/test');

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() {
  const t = Date.now().toString(36).slice(-6);
  return `KCK-${t}`;
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

test.describe('Kick flow', () => {
  test('Host kicks a participant → confirm dialog (en/de) and participant leaves /room', async ({ browser }) => {
    const roomCode = newRoomCode();
    const hostName = 'Queen';
    const victimName = 'Pawn';

    // Two contexts: host + victim
    const ctxHost = await browser.newContext();
    const ctxVictim = await browser.newContext();
    const host = await ctxHost.newPage();
    const victim = await ctxVictim.newPage();

    // Join (host first to acquire host role)
    await host.goto(roomUrlFor(hostName, roomCode), { waitUntil: 'domcontentloaded' });
    await victim.goto(roomUrlFor(victimName, roomCode), { waitUntil: 'domcontentloaded' });

    // Wait until both appear in the participant list (host page)
    await host.waitForFunction(() => {
      return document.querySelectorAll('#liveParticipantList .participant-row').length >= 2;
    });

    // Locate victim's row on host page
    const victimRow = host.locator('#liveParticipantList .participant-row', { hasText: victimName });
    await expect(victimRow).toHaveCount(1);

    // Kick button must be visible for host
    const kickBtn = victimRow.locator('button.row-action.kick');
    await expect(kickBtn).toBeVisible();

    // Intercept confirm dialog and assert text (English or German)
    let confirmMsg = '';
    host.once('dialog', async (dlg) => {
      confirmMsg = dlg.message();
      await dlg.accept();
    });

    // Click kick
    await kickBtn.click();

    // Confirm text must match either EN or DE variant in room.js
    // EN: "Remove <name>?"
    // DE: "<name> wirklich entfernen?"
    expect(confirmMsg, 'Confirm dialog not shown').toBeTruthy();
    const re = new RegExp(
      `^(Remove\\s+${victimName}\\?|${victimName}\\s+wirklich\\s+entfernen\\?)$`
    );
    expect(re.test(confirmMsg)).toBeTruthy();

    // The victim should navigate away from /room (server sends "kicked" → redirect "/")
    const prevUrl = victim.url();
    await victim.waitForFunction(() => !location.pathname.startsWith('/room'), null, { timeout: 5000 })
      .catch(() => {}); // keep test robust across environments

    const nowUrl = victim.url();
    expect(
      !new URL(nowUrl).pathname.startsWith('/room'),
      `Victim did not leave /room (prev: ${prevUrl}, now: ${nowUrl})`
    ).toBeTruthy();

    await ctxHost.close();
    await ctxVictim.close();
  });
});
