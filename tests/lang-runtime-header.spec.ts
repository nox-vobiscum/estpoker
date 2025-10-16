import { test, expect } from '@playwright/test';

test('Header language control toggles EN ↔ DE and reflects state twice (idempotent)', async ({ page }) => {
  const roomCode = 'lang-runtime';
  await page.goto(`/room?roomCode=${roomCode}&participantName=Tester&preflight=1`);

  const enBtn = page.locator('#hcLangEN');
  const deBtn = page.locator('#hcLangDE');
  const label = page.locator('h2[data-i18n="label.participants"]');

  await expect(enBtn).toBeVisible();
  await expect(deBtn).toBeVisible();
  await expect(label).toBeVisible();

  const readLang = async () =>
    (await page.evaluate(() => document.documentElement.getAttribute('lang') || 'en')).toLowerCase();

  const flipTo = async (target: 'en' | 'de') => {
    if (target === 'en') await enBtn.click();
    else await deBtn.click();
    await expect
      .poll(async () => (await readLang()))
      .toBe(target);

    const expected = target === 'de' ? 'Teilnehmende' : 'Participants';
    await expect
      .poll(async () => (await label.textContent())?.trim() || '')
      .toBe(expected);

    // pressed state
    await expect(enBtn).toHaveAttribute('aria-pressed', target === 'en' ? 'true' : 'false');
    await expect(deBtn).toHaveAttribute('aria-pressed', target === 'de' ? 'true' : 'false');
  };

  const start = await readLang();
  const other = start.startsWith('de') ? 'en' as const : 'de' as const;

  await flipTo(other);
  await flipTo(start.startsWith('de') ? 'de' : 'en'); // switch back
});
