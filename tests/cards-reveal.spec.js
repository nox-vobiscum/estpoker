// Critical path: 3 users → choose cards → host reveals → average shown
// Env:
//   EP_BASE_URL  (e.g. http://localhost:8080 or https://ep.noxvobiscum.at)
//   EP_ROOM_URL  (optional full URL; if set, we append &participantName=... per user)
// Usage:
//   npx playwright test tests/cards-reveal.spec.js
const { test, expect } = require('@playwright/test');

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() {
  // short unique code to avoid collisions
  const t = Date.now().toString(36).slice(-6);
  return `E2E-${t}`;
}
function roomUrlFor(name, roomCode) {
  const full = process.env.EP_ROOM_URL;
  if (full) {
    // If a full room URL is provided, we just append/replace participantName
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

async function waitVisible(page, selector) {
  await expect(page.locator(selector)).toBeVisible();
}

test.describe('Critical path: vote → reveal → average', () => {
  test('3 participants can vote, host reveals, average is shown', async ({ browser }) => {
    const roomCode = newRoomCode();

    // Create 3 isolated contexts (simulate 3 browsers)
    const ctxHost = await browser.newContext();
    const ctxJ    = await browser.newContext();
    const ctxM    = await browser.newContext();

    const host = await ctxHost.newPage();
    const julia = await ctxJ.newPage();
    const max   = await ctxM.newPage();

    // 1) Open pages (host first so they become host)
    await host.goto(roomUrlFor('Roland', roomCode), { waitUntil: 'domcontentloaded' });
    await waitVisible(host, '#cardGrid');

    await julia.goto(roomUrlFor('Julia', roomCode), { waitUntil: 'domcontentloaded' });
    await waitVisible(julia, '#cardGrid');

    await max.goto(roomUrlFor('Max', roomCode), { waitUntil: 'domcontentloaded' });
    await waitVisible(max, '#cardGrid');

    // 2) Two participants choose numeric cards (assumes default deck contains 3 & 5)
    //    Click buttons by exact text.
    await julia.getByRole('button', { name: '3' }).click();
    await max.getByRole('button', { name: '5' }).click();

    // 3) Host reveals (button should be visible for host)
    const revealBtn = host.locator('#revealButton');
    await expect(revealBtn).toBeVisible();
    await revealBtn.click();

    // 4) After reveal, expect vote chips to be rendered and average numeric (not N/A)
    //    Check on host page (could also check on others).
    const chips = host.locator('.vote-chip');
    await expect(chips).toHaveCountGreaterThan(0);

    // Contains at least '3' and '5' somewhere
    const chipTexts = await chips.allTextContents();
    expect(chipTexts.join(' ')).toContain('3');
    expect(chipTexts.join(' ')).toContain('5');

    const avgEl = host.locator('#averageVote');
    await expect(avgEl).toBeVisible();
    const avgText = (await avgEl.textContent() || '').trim();
    expect(avgText).not.toBe('N/A');
    // Should be a number (allow integers or decimals)
    expect(/^\d+([.,]\d+)?$/.test(avgText)).toBeTruthy();

    // 5) Reset should now be visible for host
    await expect(host.locator('#resetButton')).toBeVisible();

    // Cleanup
    await ctxHost.close();
    await ctxJ.close();
    await ctxM.close();
  });
});
