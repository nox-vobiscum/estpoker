import { test, expect } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

test('imprint is public, bilingual and linked from the shared footer', async ({ page }) => {
  await page.goto('/imprint?lang=en');
  await expect(page).toHaveTitle("Imprint | RBS' Planning Poker");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://planning-poker.at/imprint');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('Imprint');
  await expect(page.locator('main').getByText('Roland B. Seper', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'noxvobiscum@gmail.com' })).toHaveAttribute('href', 'mailto:noxvobiscum@gmail.com');
  await expect(page.locator('.footer-nav a')).toHaveText(['Home', 'About', 'Imprint']);

  await page.locator('#hcLangDE').click();
  await expect(page).toHaveTitle("Impressum | RBS' Planning Poker");
  await expect(page.locator('h1')).toHaveText('Impressum');
  await expect(page.getByText('Medieninhaber, Betreiber und für den Inhalt verantwortlich')).toBeVisible();
  await expect(page.locator('.footer-nav a')).toHaveText(['Startseite', 'Über', 'Impressum']);
});

test('imprint offers the contextual return to an active room', async ({ page }) => {
  const room = newRoomCode('IMPRINT');
  await page.goto(roomUrlFor('Returner', room));
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('pp-room-return') || 'null')?.roomCode)).toBe(room);
  await page.goto('/imprint');
  await expect(page.locator('#roomReturnLink')).toBeVisible();
  await expect(page.locator('#roomReturnLink')).toContainText(room);
  await expect(page.locator('#roomReturnLink')).toHaveAttribute('href', `/room?roomCode=${room}&participantName=Returner`);
});

test('shared footer links to the imprint and the page remains usable on mobile', async ({ page }) => {
  for (const path of ['/', '/about', '/invite', '/room?roomCode=footer-check&participantName=Check']) {
    await page.goto(path);
    await expect(page.locator('.footer-nav a[href="/imprint"]')).toHaveCount(1);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/imprint?lang=en');
  await expect(page.locator('.app-header')).toBeVisible();
  await expect(page.locator('h1')).toBeVisible();
  await page.locator('.app-footer').scrollIntoViewIfNeeded();
  await expect(page.locator('.app-footer')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
