// Language header control: EN ↔ DE toggles live without reload
// Run: npx playwright test tests/lang-runtime-header.spec.ts

import { test, expect } from '@playwright/test';

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() { return `LANG-${Date.now().toString(36).slice(-6)}`; }
function roomUrlFor(name: string, roomCode: string) {
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

test('Header language control toggles EN ↔ DE and updates UI', async ({ page }) => {
  const roomCode = newRoomCode();
  await page.goto(roomUrlFor('LangUser', roomCode), { waitUntil: 'domcontentloaded' });

  const btnEN = page.locator('#hcLangEN');
  const btnDE = page.locator('#hcLangDE');

  await expect(btnEN).toBeVisible();
  await expect(btnDE).toBeVisible();

  // stabiler i18n-Knoten auf /room
  const i18nSample = page.locator('[data-i18n="label.participants"]');
  await expect(i18nSample).toBeVisible();

  const beforeLang = await page.evaluate(() => (document.documentElement.lang || 'en').slice(0,2));
  const beforeText = (await i18nSample.textContent())?.trim() || '';

  // toggle target
  const target = beforeLang === 'de' ? 'en' : 'de';
  if (target === 'en') await btnEN.click(); else await btnDE.click();

  // warte auf lang flip
  await page.waitForFunction(
    (prev) => (document.documentElement.lang || '').slice(0,2) !== prev,
    beforeLang
  );

  const afterLang = await page.evaluate(() => (document.documentElement.lang || '').slice(0,2));
  expect(afterLang).toBe(target);

  // text sollte sich ändern
  await expect
    .poll(async () => (await i18nSample.textContent())?.trim() || '', { timeout: 5000 })
    .not.toBe(beforeText);

  // aria-pressed Reflektion
  await expect(btnEN).toHaveAttribute('aria-pressed', target === 'en' ? 'true' : 'false');
  await expect(btnDE).toHaveAttribute('aria-pressed', target === 'de' ? 'true' : 'false');

  // zurück toggeln
  if (target === 'en') await btnDE.click(); else await btnEN.click();
  await page.waitForFunction(
    (expected) => (document.documentElement.lang || '').slice(0,2) === expected,
    beforeLang
  );
});
