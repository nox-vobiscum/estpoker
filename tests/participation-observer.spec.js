// Participation / Observer mode E2E:
// - Toggling participation OFF (observer) disables all card buttons for that user
// - Host sees 👁 observer icon for that participant
// - Toggling back ON re-enables voting and removes the observer icon
// Run:
//   npx playwright test tests/participation-observer.spec.js
// Env:
//   EP_BASE_URL  (e.g. http://localhost:8080 or https://ep.noxvobiscum.at)
//   EP_ROOM_URL  (optional full room URL; overrides base; test appends participant & room)

const { test, expect } = require('@playwright/test');

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() {
  const t = Date.now().toString(36).slice(-6);
  return `OBS-${t}`;
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
    await expect(overlay).toBeHidden();
  }
}

test.describe('Participation → Observer mode disables voting', () => {
  test('Toggle participation off/on updates UI for user and host list', async ({ browser }) => {
    const roomCode = newRoomCode();
    const hostName = 'Hoster';
    const userName = 'Viewer';

    // Host + user contexts
    const ctxHost = await browser.newContext();
    const ctxUser = await browser.newContext();
    const host = await ctxHost.newPage();
    const user = await ctxUser.newPage();

    // Join (host first)
    await host.goto(roomUrlFor(hostName, roomCode), { waitUntil: 'domcontentloaded' });
    await user.goto(roomUrlFor(userName, roomCode), { waitUntil: 'domcontentloaded' });

    await waitGridReady(host);
    await waitGridReady(user);

    // --- Switch user to Observer via menu ---
    await ensureMenuOpen(user);
    const partToggle = user.locator('#menuParticipationToggle');
    await expect(partToggle).toHaveCount(1);

    // If currently estimating, click to become observer
    if (await partToggle.isChecked()) {
      await partToggle.click({ force: true });
      await user.waitForTimeout(120); // WS roundtrip grace
    }
    await ensureMenuClosed(user);

    // On user's own page: all card buttons should be disabled
    const totalButtons = await user.locator('#cardGrid button').count();
    expect(totalButtons).toBeGreaterThan(0);
    const enabledButtons = await user.locator('#cardGrid button:enabled').count();
    expect(enabledButtons).toBe(0);

    // On host page: user's row shows observer icon 👁
    await host.waitForTimeout(150);
    const userRow = host.locator('#liveParticipantList .participant-row', { hasText: userName });
    await expect(userRow).toHaveCount(1);
    const eyeIcon = userRow.locator('.status-icon.observer');
    await expect(eyeIcon).toHaveCount(1);

    // --- Switch user back to Estimating ---
    await ensureMenuOpen(user);
    if (!(await partToggle.isChecked())) {
      await partToggle.click({ force: true });
      await user.waitForTimeout(120);
    }
    await ensureMenuClosed(user);

    // Now some buttons should be enabled again
    const enabledAfter = await user.locator('#cardGrid button:enabled').count();
    expect(enabledAfter).toBeGreaterThan(0);

    // Host should no longer show observer icon for that user
    await host.waitForTimeout(150);
    await expect(userRow.locator('.status-icon.observer')).toHaveCount(0);

    await ctxHost.close(); await ctxUser.close();
  });
});
