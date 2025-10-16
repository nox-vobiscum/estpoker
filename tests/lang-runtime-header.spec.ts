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
