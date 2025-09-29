// Specials & Stats E2E:
// Goal: Special votes (e.g. ☕) should NOT be included in the average.
// Scenario: 3 users → votes = [3, ☕, 5]. After reveal, average should be ~4.
// Also asserts that a ☕ chip is rendered after reveal.
//
// Run:
//   npx playwright test tests/specials-stats.spec.js
// Env:
//   EP_BASE_URL  (e.g. http://localhost:8080 or https://ep.noxvobiscum.at)
//   EP_ROOM_URL  (optional full room URL; overrides base; test appends participant & room)

import { test, expect, Page, Browser } from '@playwright/test';

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() {
  const t = Date.now().toString(36).slice(-6);
  return `SPC-${t}`;
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

// Wait until grid has buttons rendered
async function waitGridReady(page) {
  const grid = page.locator('#cardGrid');
  await expect(grid).toHaveCount(1);
  await page.waitForFunction(() => {
    const g = document.querySelector('#cardGrid');
    return !!g && g.querySelectorAll('button').length > 0;
  });
}

// Click a card by exact label (e.g. "3", "5", "☕")
async function clickCardExact(page, label) {
  const byRole = page.getByRole('button', { name: label, exact: true });
  if (await byRole.count()) { await byRole.first().click(); return true; }
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byText = page.locator('button', { hasText: new RegExp(`^\\s*${esc}\\s*$`) });
  if (await byText.count()) { await byText.first().click(); return true; }
  return false;
}

test.describe('Specials do not affect average', () => {
  test('Votes [3, ☕, 5] ⇒ average ≈ 4; ☕ chip visible after reveal', async ({ browser }) => {
    const roomCode = newRoomCode();

    // Three isolated contexts (host acquires host role by joining first)
    const ctxHost = await browser.newContext();
    const ctxA    = await browser.newContext();
    const ctxB    = await browser.newContext();

    const host = await ctxHost.newPage();
    const a    = await ctxA.newPage();
    const b    = await ctxB.newPage();

    await host.goto(roomUrlFor('Host', roomCode),   { waitUntil: 'domcontentloaded' });
    await a.goto(roomUrlFor('Alice', roomCode),     { waitUntil: 'domcontentloaded' });
    await b.goto(roomUrlFor('Bob', roomCode),       { waitUntil: 'domcontentloaded' });

    await waitGridReady(host);
    await waitGridReady(a);
    await waitGridReady(b);

    // Cast votes: 3, ☕, 5 (☕ is always appended in UI specials row)
    expect(await clickCardExact(a, '3')).toBeTruthy();
    expect(await clickCardExact(b, '☕')).toBeTruthy();
    expect(await clickCardExact(host, '5')).toBeTruthy();

    // Reveal on host
    const revealBtn = host.locator('#revealButton');
    await expect(revealBtn).toBeVisible();
    await revealBtn.click();

    // Average should be numeric and ~4 (ignore locale comma vs dot)
    const avgEl = host.locator('#averageVote');
    await expect(avgEl).toBeVisible();
    const avgText = (await avgEl.textContent() || '').trim();
    const avgNum = parseFloat(avgText.replace(',', '.'));
    expect(Number.isNaN(avgNum)).toBeFalsy();
    // Allow minor formatting/rounding differences
    expect(Math.abs(avgNum - 4)).toBeLessThanOrEqual(0.11);

    // A ☕ chip should be rendered for the special vote
    const chips = host.locator('.vote-chip');
    await expect(chips).toHaveCountGreaterThan(0);
    const allChipTexts = (await chips.allTextContents()).map(t => (t || '').trim());
    expect(allChipTexts.join(' ')).toContain('☕');

    await ctxHost.close(); await ctxA.close(); await ctxB.close();
  });
});

// Small extension to Playwright's expect for readability
expect.extend({
  async toHaveCountGreaterThan(locator, min) {
    const count = await locator.count();
    if (count > min) {
      return { pass: true, message: () => `expected count not to be > ${min}` };
    }
    return { pass: false, message: () => `expected count > ${min} but got ${count}` };
  }
});
