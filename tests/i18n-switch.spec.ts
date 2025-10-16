import { test, expect } from '@playwright/test';

test('i18n switch: header language buttons flip <html lang> and update UI text', async ({ page }) => {
  // Go directly to room to have a clearly translated label on the page.
  // preflight=1 skips name-availability redirect.
  const roomCode = 'i18n-e2e';
  await page.goto(`/room?roomCode=${roomCode}&participantName=Tester&preflight=1`);

  // Header language buttons
  const enBtn = page.locator('#hcLangEN');
  const deBtn = page.locator('#hcLangDE');

  await expect(enBtn).toBeVisible();
  await expect(deBtn).toBeVisible();

  const beforeLang = (await page.evaluate(() => document.documentElement.getAttribute('lang') || 'en')).toLowerCase();
  const targetLang = beforeLang.startsWith('de') ? 'en' : 'de';

  // Click the opposite language
  if (targetLang === 'de') {
    await deBtn.click();
  } else {
    await enBtn.click();
  }

  // <html lang> should flip
  await expect
    .poll(async () => (await page.evaluate(() => document.documentElement.getAttribute('lang') || '')))
    .toBe(targetLang);

  // A visible translated label should change (Participants ↔ Teilnehmende)
  const participantsLabel = page.locator('h2[data-i18n="label.participants"]');
  await expect(participantsLabel).toBeVisible();

  const expectedText = targetLang === 'de' ? 'Teilnehmende' : 'Participants';
  await expect
    .poll(async () => (await participantsLabel.textContent())?.trim() || '')
    .toBe(expectedText);

  // Buttons reflect pressed state
  const enPressed = await enBtn.getAttribute('aria-pressed');
  const dePressed = await deBtn.getAttribute('aria-pressed');
  expect([enPressed, dePressed].every(v => v === 'true' || v === 'false')).toBe(true);
  if (targetLang === 'de') {
    expect(dePressed).toBe('true');
    expect(enPressed).toBe('false');
  } else {
    expect(enPressed).toBe('true');
    expect(dePressed).toBe('false');
  }
});
