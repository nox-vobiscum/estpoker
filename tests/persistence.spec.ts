// Persistence E2E:
// 1) Theme persists via localStorage across reload (menu button 'aria-pressed').
// 2) Language persists across reload (<html lang> and #langCurrent label).
// 3) Auto-Reveal persists as room state across reload (guest sees it checked).
// Run:
//   npx playwright test tests/persistence.spec.js
// Env:
//   EP_BASE_URL  (e.g. http://localhost:8080 or https://ep.noxvobiscum.at)
//   EP_ROOM_URL  (optional full room URL; overrides base; test appends participant & room)

import { test, expect, Page, Browser } from '@playwright/test';

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode(prefix = 'PST') {
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

async function ensureMenuOpen(page) {
  const overlay = page.locator('#appMenuOverlay');
  if (!(await overlay.isVisible().catch(() => false))) {
    await page.locator('#menuButton').click();
    await expect(overlay).toBeVisible();
  }
}
async function ensureMenuClosed(page) {
  const overlay = page.locator('#appMenuOverlay');
  if (await overlay.isVisible().catch(() => false)) {
    await page.locator('#menuButton').click();
    await expect(overlay).toBeHidden();
  }
}

test.describe('Persistence', () => {
  test('Theme persists across reload (localStorage estpoker-theme)', async ({ page }) => {
    const room = roomUrlFor('PersistTheme', newRoomCode('THEME'));
    await page.goto(room, { waitUntil: 'domcontentloaded' });

    await ensureMenuOpen(page);

    const light = page.locator('#themeLight');
    const dark  = page.locator('#themeDark');

    // Decide target theme opposite to current pressed
    const lightPressed = (await light.getAttribute('aria-pressed')) === 'true';
    const target = lightPressed ? 'dark' : 'light';
    const btn = target === 'light' ? light : dark;

    // Click target theme (applyTheme saves to localStorage)
    await btn.click();
    await page.waitForTimeout(80);

    // Verify aria-pressed toggled
    expect(await btn.getAttribute('aria-pressed')).toBe('true');

    // Also verify localStorage value
    const stored = await page.evaluate(() => localStorage.getItem('estpoker-theme'));
    expect(stored).toBe(target);

    await ensureMenuClosed(page);

    // Reload and check the pressed indicator again (bindMenu reads from localStorage)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureMenuOpen(page);
    const afterPressed = await (target === 'light' ? light : dark).getAttribute('aria-pressed');
    expect(afterPressed).toBe('true');
  });

  test('Language persists across reload (html[lang] + label)', async ({ page }) => {
    const room = roomUrlFor('PersistLang', newRoomCode('LANG'));
    await page.goto(room, { waitUntil: 'domcontentloaded' });

    await ensureMenuOpen(page);

    // Snapshot initial lang and compute target
    const initialLang = (await page.evaluate(() => document.documentElement.getAttribute('lang') || 'en')).toLowerCase();
    const target = initialLang.startsWith('de') ? 'en' : 'de';

    // Click the language row (menu.js dispatches runtime i18n + sets cookie on server)
    await page.locator('#langRow').click();

    // Wait for either the custom event or the lang attribute to flip
    await page.waitForFunction((t) => {
      const cur = (document.documentElement.getAttribute('lang') || '').toLowerCase();
      return cur.startsWith(t);
    }, target);

    // Verify label reflects chosen language
    const label = (await page.locator('#langCurrent').textContent() || '').trim();
    expect(label).toBe(target === 'de' ? 'Deutsch' : 'English');

    // Reload and ensure lang persisted (server cookie should apply)
    await page.reload({ waitUntil: 'domcontentloaded' });
    const afterLang = (await page.evaluate(() => document.documentElement.getAttribute('lang') || '')).toLowerCase();
    expect(afterLang.startsWith(target)).toBeTruthy();
  });

  test('Auto-Reveal state persists in room across reload (guest sees it checked)', async ({ browser }) => {
    const roomCode = newRoomCode('AR');

    // Host and guest contexts
    const ctxHost = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host = await ctxHost.newPage();
    const guest = await ctxGuest.newPage();

    await host.goto(roomUrlFor('Host', roomCode), { waitUntil: 'domcontentloaded' });
    await guest.goto(roomUrlFor('Guest', roomCode), { waitUntil: 'domcontentloaded' });

    // Host enables Auto-Reveal via menu
    await ensureMenuOpen(host);
    const hostToggle = host.locator('#menuAutoRevealToggle');
    await expect(hostToggle).toHaveCount(1);
    if (!(await hostToggle.isChecked())) {
      await hostToggle.click({ force: true });
      await host.waitForTimeout(120);
    }
    await ensureMenuClosed(host);

    // Reload guest and verify the menu toggle reflects room state
    await guest.reload({ waitUntil: 'domcontentloaded' });
    await ensureMenuOpen(guest);
    const guestToggle = guest.locator('#menuAutoRevealToggle');
    if (await guestToggle.count()) {
      expect(await guestToggle.isChecked()).toBeTruthy();
      // Best-effort label text (may be "On" or localized)
      const status = (await guest.locator('#menuArStatus').textContent() || '').trim();
      expect(status.length).toBeGreaterThan(0);
    }

    await ctxHost.close(); await ctxGuest.close();
  });
});
