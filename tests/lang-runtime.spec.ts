// Language runtime E2E:
// - Open menu → click language row toggles between EN/DE without reload
// - Assert <html lang> flips, and the visible label (#langCurrent) switches text
//
// Run:
//   npx playwright test tests/lang-runtime.spec.js

import { test, expect, Page, Browser } from '@playwright/test';

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() { return `LANG-${Date.now().toString(36).slice(-6)}`; }
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
  if (!(await overlay.isVisible().catch(()=>false))) {
    await page.locator('#menuButton').click();
    await expect(overlay).toBeVisible();
  }
}

test('Language row toggles EN ↔ DE and updates UI live', async ({ page }) => {
  const roomCode = newRoomCode();
  await page.goto(roomUrlFor('LangUser', roomCode), { waitUntil: 'domcontentloaded' });

  // Open menu
  await ensureMenuOpen(page);

  const langRow   = page.locator('#langRow');
  const langLabel = page.locator('#langCurrent');

  await expect(langRow).toHaveCount(1);
  await expect(langLabel).toHaveCount(1);

  // Read current state
  const beforeLang = await page.evaluate(() => document.documentElement.lang || 'en');
  const beforeText = (await langLabel.textContent())?.trim();

  // Click language row to toggle
  await langRow.click();
  // Wait for <html lang> to flip
  await page.waitForFunction(
    (prev) => (document.documentElement.lang || '').slice(0,2) !== (prev || '').slice(0,2),
    beforeLang
  );

  const afterLang = await page.evaluate(() => (document.documentElement.lang || '').slice(0,2));
  const afterText = (await langLabel.textContent())?.trim();

  // Assert flip EN<->DE reflected by both lang attr and visible label
  if ((beforeLang || '').startsWith('de')) {
    expect(afterLang).toBe('en');
    expect(afterText).toMatch(/English/i);
  } else {
    expect(afterLang).toBe('de');
    expect(afterText).toMatch(/Deutsch/i);
  }

  // Toggle back to original for cleanliness
  await langRow.click();
  await page.waitForFunction(
    (target) => (document.documentElement.lang || '').slice(0,2) === (target || '').slice(0,2),
    (beforeLang || '').slice(0,2)
  );
});
