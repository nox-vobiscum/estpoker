// Reset flow E2E: after reveal, pressing Reset returns the room to pre-vote state.
// Run:
//   npx playwright test tests/reset-flow.spec.js
// Env:
//   EP_BASE_URL  (e.g. http://localhost:8080 or https://ep.noxvobiscum.at)
//   EP_ROOM_URL  (optional full room URL; overrides base; test appends participant & room)

import { test, expect, Page, Browser } from '@playwright/test';

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() {
  const t = Date.now().toString(36).slice(-6);
  return `RST-${t}`;
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

// Wait until grid exists and at least one card button is rendered
async function waitGridReady(page) {
  const grid = page.locator('#cardGrid');
  await expect(grid).toHaveCount(1);
  await page.waitForFunction(() => {
    const g = document.querySelector('#cardGrid');
    return !!g && g.querySelectorAll('button').length > 0;
  });
}

// Click a card by exact label ("3" must not match "13")
async function clickCardExact(page, label) {
  // Prefer accessible name (exact)
  const byRole = page.getByRole('button', { name: label, exact: true });
  if (await byRole.count()) { await byRole.first().click(); return true; }
  // Fallback: strict text match
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byText = page.locator('button', { hasText: new RegExp(`^\\s*${esc}\\s*$`) });
  if (await byText.count()) { await byText.first().click(); return true; }
  return false;
}

test.describe('Reset flow: reveal → reset → pre-vote', () => {
  test('After reveal, Reset clears chips and restores pre-vote UI', async ({ browser }) => {
    const roomCode = newRoomCode();

    // Three isolated browsers (host + 2 participants)
    const ctxHost = await browser.newContext();
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();

    const host = await ctxHost.newPage();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    // Open pages (host first so they own host role)
    await host.goto(roomUrlFor('Host', roomCode), { waitUntil: 'domcontentloaded' });
    await a.goto(roomUrlFor('Alice', roomCode),   { waitUntil: 'domcontentloaded' });
    await b.goto(roomUrlFor('Bob', roomCode),     { waitUntil: 'domcontentloaded' });

    // Ensure card grids are ready (buttons present)
    await waitGridReady(host);
    await waitGridReady(a);
    await waitGridReady(b);

    // Everyone votes (use 3/5/8 from default deck)
    expect(await clickCardExact(a, '3')).toBeTruthy();
    expect(await clickCardExact(b, '5')).toBeTruthy();
    expect(await clickCardExact(host, '8')).toBeTruthy();

    // Reveal on host
    const revealBtn = host.locator('#revealButton');
    await expect(revealBtn).toBeVisible();
    await revealBtn.click();

    // Reveal state: reset visible, chips present, average numeric
    const resetBtn = host.locator('#resetButton');
    await expect(resetBtn).toBeVisible();

    const chips = host.locator('.vote-chip');
    expect(await chips.count()).toBeGreaterThan(0);

    const avgEl = host.locator('#averageVote');
    await expect(avgEl).toBeVisible();
    const avgText = (await avgEl.textContent() || '').trim();
    expect(avgText).not.toBe('N/A');

    // Perform reset
    await resetBtn.click();

    // Pre-vote state should be restored:
    // - reset button hidden, reveal button visible again
    await expect(host.locator('#resetButton')).toBeHidden();
    await expect(host.locator('#revealButton')).toBeVisible();

    // - chips removed (count 0) after server roundtrip
    await host.waitForTimeout(150); // small grace for WS update
    expect(await host.locator('.vote-chip').count()).toBe(0);

    // - pre/post containers reflect state (best-effort if present)
    const pre = host.locator('.pre-vote');
    const post = host.locator('.post-vote');
    if (await pre.count()) { await expect(pre).toBeVisible(); }
    if (await post.count()) { await expect(post).toBeHidden(); }

    await ctxHost.close(); await ctxA.close(); await ctxB.close();
  });
});
