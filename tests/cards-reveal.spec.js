// Critical path: 3 users → choose cards → host reveals → average shown
// Env:
//   EP_BASE_URL  (e.g. http://localhost:8080 or https://ep.noxvobiscum.at)
//   EP_ROOM_URL  (optional full URL; if set, this test appends/overrides participant & room)
// Run:
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

// Click a card by its label exactly ("3" must not match "13")
async function clickCardExact(page, label) {
  // Prefer accessible name (exact)
  const byRole = page.getByRole('button', { name: label, exact: true });
  if (await byRole.count()) {
    await byRole.first().click();
    return true;
  }
  // Fallback: strict text match
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byText = page.locator('button', { hasText: new RegExp(`^\\s*${esc}\\s*$`) });
  if (await byText.count()) {
    await byText.first().click();
    return true;
  }
  return false;
}

test.describe('Critical path: vote → reveal → average', () => {
  test('3 participants vote, host reveals, average is shown', async ({ browser }) => {
    const roomCode = newRoomCode();

    // Simulate 3 independent browsers (contexts)
    const ctxHost = await browser.newContext();
    const ctxJ    = await browser.newContext();
    const ctxM    = await browser.newContext();

    const host  = await ctxHost.newPage();
    const julia = await ctxJ.newPage();
    const max   = await ctxM.newPage();

    // 1) Open pages (host first so they become the host)
    await host.goto(roomUrlFor('Roland', roomCode), { waitUntil: 'domcontentloaded' });
    await waitVisible(host, '#cardGrid');

    await julia.goto(roomUrlFor('Julia', roomCode), { waitUntil: 'domcontentloaded' });
    await waitVisible(julia, '#cardGrid');

    await max.goto(roomUrlFor('Max', roomCode), { waitUntil: 'domcontentloaded' });
    await waitVisible(max, '#cardGrid');

    // 2) All three cast votes to make the round deterministic before reveal
    const okJ = await clickCardExact(julia, '3');
    const okM = await clickCardExact(max,   '5');
    const okH = await clickCardExact(host,  '8');
    expect(okJ, 'Card "3" not found/clickable').toBeTruthy();
    expect(okM, 'Card "5" not found/clickable').toBeTruthy();
    expect(okH, 'Card "8" not found/clickable').toBeTruthy();

    // 3) Host reveals
    const revealBtn = host.locator('#revealButton');
    await expect(revealBtn).toBeVisible();
    await revealBtn.click();

    // Wait explicitly for "revealed" state from server (reset button appears)
    await expect(host.locator('#resetButton')).toBeVisible();

    // 4) After reveal: chips visible, should include 3 and 5; average is numeric (not "N/A")
    const chips = host.locator('.vote-chip');
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThan(0);

    const chipTexts = (await chips.allTextContents()).map(t => (t || '').trim());
    expect(chipTexts.join(' ')).toContain('3');
    expect(chipTexts.join(' ')).toContain('5');

    const avgEl = host.locator('#averageVote');
    await expect(avgEl).toBeVisible();
    const avgText = (await avgEl.textContent() || '').trim();
    expect(avgText).not.toBe('N/A');
    expect(/^\d+([.,]\d+)?$/.test(avgText)).toBeTruthy();

    // Cleanup
    await ctxHost.close(); await ctxJ.close(); await ctxM.close();
  });
});
