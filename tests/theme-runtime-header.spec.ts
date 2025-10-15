// Theme header control: Light / Dark / System reflect data-theme + aria
// Run: npx playwright test tests/theme-runtime-header.spec.ts

import { test, expect } from '@playwright/test';

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() { return `THEME-${Date.now().toString(36).slice(-6)}`; }
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

test('Header theme segmented control reflects state (aria + data-theme)', async ({ page }) => {
  const roomCode = newRoomCode();
  await page.goto(roomUrlFor('ThemeUser', roomCode), { waitUntil: 'domcontentloaded' });

  const bLight  = page.locator('#hcThemeLight');
  const bDark   = page.locator('#hcThemeDark');
  const bSystem = page.locator('#hcThemeSystem');

  await expect(bLight).toBeVisible();
  await expect(bDark).toBeVisible();
  await expect(bSystem).toBeVisible();

  // Dark
  await bDark.click();
  await expect
    .poll(async () => await page.evaluate(() => document.documentElement.getAttribute('data-theme')))
    .toBe('dark');
  await expect(bDark).toHaveAttribute('aria-pressed', 'true');
  await expect(bLight).toHaveAttribute('aria-pressed', 'false');
  await expect(bSystem).toHaveAttribute('aria-pressed', 'false');

  // Light
  await bLight.click();
  await expect
    .poll(async () => await page.evaluate(() => document.documentElement.getAttribute('data-theme')))
    .toBe('light');
  await expect(bLight).toHaveAttribute('aria-pressed', 'true');

  // System (removes data-theme)
  await bSystem.click();
  await expect
    .poll(async () => await page.evaluate(() => document.documentElement.hasAttribute('data-theme')))
    .toBe(false);
  await expect(bSystem).toHaveAttribute('aria-pressed', 'true');
});
