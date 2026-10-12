// Header language control: EN ↔ DE toggle should update <html lang> and aria-pressed
// NOTE: Keep code/comments EN only (per project guideline)

import { test, expect } from '@playwright/test';

test.describe('Header language control', () => {
  test('toggles EN ↔ DE and reflects state twice (idempotent)', async ({ page }) => {
    // Ensure non-compact header (both EN/DE segments visible)
    await page.setViewportSize({ width: 1024, height: 800 });

    await page.goto('/');

    const btnEN = page.locator('#hcLangEN');
    const btnDE = page.locator('#hcLangDE');

    await expect(btnDE).toHaveText('DE');
    await expect(btnEN).toHaveText('EN');
    await expect(page.locator('[data-header-language] img')).toHaveCount(0);
    // Sanity: both buttons present and visible in non-compact mode
    await expect(btnEN).toBeVisible();
    await expect(btnDE).toBeVisible();

    const rootLang = async () =>
      (await page.evaluate(() => document.documentElement.getAttribute('lang') || 'en')).toLowerCase();

    async function flipTo(target: 'en' | 'de') {
      const before = await rootLang();

      // Click target button (also click if already set to assert idempotence)
      if (target === 'en') {
        await btnEN.click();
      } else {
        await btnDE.click();
      }

      // Wait for <html lang> to reflect the target language
      await expect.poll(rootLang).toBe(target);

      // Wait for aria-pressed states to reflect the target language
      await expect
        .poll(async () => (await btnEN.getAttribute('aria-pressed')) || '')
        .toBe(target === 'en' ? 'true' : 'false');

      await expect
        .poll(async () => (await btnDE.getAttribute('aria-pressed')) || '')
        .toBe(target === 'de' ? 'true' : 'false');

      const selected = target === 'en' ? btnEN : btnDE;
      const other = target === 'en' ? btnDE : btnEN;
      expect(await selected.evaluate(button => getComputedStyle(button).backgroundColor))
        .not.toBe(await other.evaluate(button => getComputedStyle(button).backgroundColor));
      expect(await selected.evaluate(button => getComputedStyle(button).color)).toBe('rgb(255, 255, 255)');
      // If it was already the same lang, ensure it stayed consistent (idempotent behavior)
      if (before === target) {
        await expect.poll(rootLang).toBe(target);
      }
    }

    // Flip a few times to prove stability and idempotence
    await flipTo('de');
    await flipTo('en');
    await flipTo('de');
    await flipTo('en');
  });
});

test('mobile DE/EN controls support keyboard, reload and desktop synchronization', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await page.evaluate(() => (window as any).PPUI.ready);
  await expect(page.locator('.app-header button:visible')).toHaveCount(1);
  await page.locator('#menuButton').click();
  await expect(page.locator('#menuLang [data-header-language]')).toHaveText(['DE', 'EN']);
  await page.locator('#menuLangDE').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('#menuLangDE')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('#menuLangDE').evaluate(button => getComputedStyle(button).backgroundColor))
    .not.toBe(await page.locator('#menuLangEN').evaluate(button => getComputedStyle(button).backgroundColor));
  await page.keyboard.press('Escape');
  await page.reload();
  await page.evaluate(() => (window as any).PPUI.ready);
  await page.locator('#menuButton').click();
  await expect(page.locator('#menuLangDE')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('#menuLangDE').evaluate(button => getComputedStyle(button).backgroundColor))
    .not.toBe(await page.locator('#menuLangEN').evaluate(button => getComputedStyle(button).backgroundColor));
  await page.locator('#menuLangEN').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#menuLangEN')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('#hcLangEN')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#hcLang [data-header-language]')).toHaveText(['DE', 'EN']);
  expect(await page.evaluate(() => localStorage.getItem('lang'))).toBe('en');
});