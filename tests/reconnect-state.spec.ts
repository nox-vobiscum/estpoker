// Reconnect state E2E:
// - After reveal, a refreshed participant sees the revealed UI (post-vote, chips, non-host buttons hidden).
// - After reset, a refreshed participant sees pre-vote UI (no chips, reveal visible only for host).
// Run:
//   npx playwright test tests/reconnect-state.spec.js
// Env:
//   EP_BASE_URL  (e.g. http://localhost:8080 or https://ep.noxvobiscum.at)
//   EP_ROOM_URL  (optional full room URL; overrides base; test appends participant & room)
import { test, expect, Page, Browser } from '@playwright/test';

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode(prefix = 'RCN') {
  const t = Date.now().toString(36).slice(-6);
  return `${prefix}-${t}`;
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

// Wait until the card grid has at least one button rendered (WS + initial render ready)
async function waitGridReady(page) {
  const grid = page.locator('#cardGrid');
  await expect(grid).toHaveCount(1);
  await page.waitForFunction(() => {
    const g = document.querySelector('#cardGrid');
    return !!g && g.querySelectorAll('button').length > 0;
  });
}

// Click a card by its label exactly ("3" must not match "13")
async function clickCardExact(page, label) {
  const byRole = page.getByRole('button', { name: label, exact: true });
  if (await byRole.count()) { await byRole.first().click(); return true; }
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byText = page.locator('button', { hasText: new RegExp(`^\\s*${esc}\\s*$`) });
  if (await byText.count()) { await byText.first().click(); return true; }
  return false;
}

test.describe('Reconnect state', () => {
  test('Refresh after reveal shows revealed UI for a non-host', async ({ browser }) => {
    const roomCode = newRoomCode('RCN1');

    // Host + 2 participants
    const ctxHost = await browser.newContext();
    const ctxA    = await browser.newContext();
    const ctxB    = await browser.newContext();

    const host = await ctxHost.newPage();
    const a    = await ctxA.newPage();
    const b    = await ctxB.newPage();

    // Join (host first to acquire host role)
    await host.goto(roomUrlFor('Host', roomCode), { waitUntil: 'domcontentloaded' });
    await a.goto(roomUrlFor('Alice', roomCode),   { waitUntil: 'domcontentloaded' });
    await b.goto(roomUrlFor('Bob', roomCode),     { waitUntil: 'domcontentloaded' });

    await waitGridReady(host);
    await waitGridReady(a);
    await waitGridReady(b);

    // Votes (use 3/5/8 from default deck)
    expect(await clickCardExact(a, '3')).toBeTruthy();
    expect(await clickCardExact(b, '5')).toBeTruthy();
    expect(await clickCardExact(host, '8')).toBeTruthy();

    // Reveal on host
    await expect(host.locator('#revealButton')).toBeVisible();
    await host.locator('#revealButton').click();
    await expect(host.locator('#resetButton')).toBeVisible(); // host shows reset in revealed state

    // Now refresh participant B and assert they see the revealed UI
    await b.reload({ waitUntil: 'domcontentloaded' });

    // post-vote should be visible, pre-vote hidden (if present)
    const pre = b.locator('.pre-vote');
    const post = b.locator('.post-vote');
    if (await pre.count()) { await expect(pre).toBeHidden(); }
    if (await post.count()) { await expect(post).toBeVisible(); }

    // Chips should be present in participant list
    await b.waitForTimeout(150); // short grace for WS sync after reload
    expect(await b.locator('.vote-chip').count()).toBeGreaterThan(0);

    // Non-host should NOT see reveal/reset buttons
    if (await b.locator('#revealButton').count()) {
      await expect(b.locator('#revealButton')).toBeHidden();
    }
    if (await b.locator('#resetButton').count()) {
      await expect(b.locator('#resetButton')).toBeHidden();
    }

    await ctxHost.close(); await ctxA.close(); await ctxB.close();
  });

  test('Refresh after reset shows pre-vote UI for a non-host', async ({ browser }) => {
    const roomCode = newRoomCode('RCN2');

    const ctxHost = await browser.newContext();
    const ctxA    = await browser.newContext();
    const ctxB    = await browser.newContext();

    const host = await ctxHost.newPage();
    const a    = await ctxA.newPage();
    const b    = await ctxB.newPage();

    await host.goto(roomUrlFor('Host', roomCode), { waitUntil: 'domcontentloaded' });
    await a.goto(roomUrlFor('Alice', roomCode),   { waitUntil: 'domcontentloaded' });
    await b.goto(roomUrlFor('Bob', roomCode),     { waitUntil: 'domcontentloaded' });

    await waitGridReady(host);
    await waitGridReady(a);
    await waitGridReady(b);

    // Vote & reveal
    expect(await clickCardExact(a, '3')).toBeTruthy();
    expect(await clickCardExact(b, '5')).toBeTruthy();
    expect(await clickCardExact(host, '8')).toBeTruthy();

    await expect(host.locator('#revealButton')).toBeVisible();
    await host.locator('#revealButton').click();
    await expect(host.locator('#resetButton')).toBeVisible();

    // Reset the round
    await host.locator('#resetButton').click();
    await expect(host.locator('#resetButton')).toBeHidden();
    await expect(host.locator('#revealButton')).toBeVisible();

    // Refresh participant A and assert pre-vote UI
    await a.reload({ waitUntil: 'domcontentloaded' });

    // pre-vote visible, post-vote hidden (if present)
    const pre = a.locator('.pre-vote');
    const post = a.locator('.post-vote');
    if (await pre.count()) { await expect(pre).toBeVisible(); }
    if (await post.count()) { await expect(post).toBeHidden(); }

    // No chips rendered after reset
    await a.waitForTimeout(150);
    expect(await a.locator('.vote-chip').count()).toBe(0);

    // Host-only reveal visible on host, but not on participant
    if (await a.locator('#revealButton').count()) {
      await expect(a.locator('#revealButton')).toBeHidden();
    }

    await ctxHost.close(); await ctxA.close(); await ctxB.close();
  });
});
