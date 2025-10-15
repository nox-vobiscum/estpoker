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

  await expect(btnEN).toHaveCount(1);
  await expect(btnDE).toHaveCount(1);
  await expect(btnEN).toBeVisible();
  await expect(btnDE).toBeVisible();

  // stabiler i18n-Knoten auf der /room-Seite
  const i18nNode = page.locator('[data-i18n="label.participants"]');
  await expect(i18nNode).toBeVisible();

  const beforeLang = await page.evaluate(() => (document.documentElement.lang || 'en').slice(0,2));

  if (beforeLang === 'de') {
    await btnEN.click();
    await page.waitForFunction(() => (document.documentElement.lang || '').slice(0,2) === 'en');
    await expect(i18nNode).toHaveText(/Participants/i);
    // zurückschalten
    await btnDE.click();
    await page.waitForFunction(() => (document.documentElement.lang || '').slice(0,2) === 'de');
  } else {
    await btnDE.click();
    await page.waitForFunction(() => (document.documentElement.lang || '').slice(0,2) === 'de');
    await expect(i18nNode).toHaveText(/Teilnehm|Teilnehmer/i);
    // zurückschalten
    await btnEN.click();
    await page.waitForFunction(() => (document.documentElement.lang || '').slice(0,2) === 'en');
  }
});
