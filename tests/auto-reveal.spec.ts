// Auto-Reveal E2E: after all votes, reveal happens automatically (no host click)
// Run:
//   npx playwright test tests/auto-reveal.spec.js
// Env:
//   EP_BASE_URL=https://ep.noxvobiscum.at   (or local http://localhost:8080)
//   EP_ROOM_URL=<full room URL>             (optional; overrides BASE)

import { test, expect, Page, Browser } from '@playwright/test';

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() {
  // Short unique code to avoid collisions
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
    // Prefer the explicit close button to avoid clicking the backdrop in front of the grid
    await page.locator('#menuButton').click();
    await expect(overlay).toBeHidden();
  }
}

async function ensureChecked(page, selector) {
  const el = page.locator(selector);
  await expect(el, `Missing element ${selector}`).toHaveCount(1);
  if (!(await el.isChecked())) {
    await el.click({ force: true });
    await page.waitForTimeout(80);
  }
}

// Click a card by its label exactly ("3" must not match "13")
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

test.describe('Auto-Reveal: all votes → auto reveal', () => {
  test('Host toggles Auto-Reveal, 3 users vote, reveal happens automatically', async ({ browser }) => {
    const roomCode = newRoomCode();

    // Three isolated browser contexts
    const ctxHost = await browser.newContext();
    const ctxJ    = await browser.newContext();
    const ctxM    = await browser.newContext();

    const host  = await ctxHost.newPage();
    const julia = await ctxJ.newPage();
    const max   = await ctxM.newPage();

    // Open pages (host first so they keep host role)
    await host.goto(roomUrlFor('Roland', roomCode), { waitUntil: 'domcontentloaded' });
    await waitVisible(host, '#cardGrid');

    await julia.goto(roomUrlFor('Julia', roomCode), { waitUntil: 'domcontentloaded' });
    await waitVisible(julia, '#cardGrid');

    await max.goto(roomUrlFor('Max', roomCode), { waitUntil: 'domcontentloaded' });
    await waitVisible(max, '#cardGrid');

    // Enable Auto-Reveal via host menu
    await ensureMenuOpen(host);
    await ensureChecked(host, '#menuAutoRevealToggle');

    // IMPORTANT: close the overlay before clicking cards (backdrop intercepts pointer events)
    await ensureMenuClosed(host);

    // All three cast a vote (default Fibonacci deck assumed: 3, 5, 8)
    const okJ = await clickCardExact(julia, '3');
    const okM = await clickCardExact(max, '5');
    const okH = await clickCardExact(host,  '8');
    expect(okJ, 'Card "3" not found/clickable').toBeTruthy();
    expect(okM, 'Card "5" not found/clickable').toBeTruthy();
    expect(okH, 'Card "8" not found/clickable').toBeTruthy();

    // Expect: Without any host click, reveal state is reached (reset button visible),
    // and average is visible and numeric (not "N/A")
    await expect(host.locator('#resetButton')).toBeVisible();

    const avgEl = host.locator('#averageVote');
    await expect(avgEl).toBeVisible();
    const avgText = (await avgEl.textContent() || '').trim();
    expect(avgText).not.toBe('N/A');
    expect(/^\d+([.,]\d+)?$/.test(avgText)).toBeTruthy();

    // Cleanup
    await ctxHost.close(); await ctxJ.close(); await ctxM.close();
  });
});
