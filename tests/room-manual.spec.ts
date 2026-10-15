import { expect, test } from '@playwright/test';
import { newRoomCode } from './utils/env';

function roomUrl(language: 'de' | 'en') {
  return `/room?roomCode=${newRoomCode('GUIDE')}&participantName=Host&lang=${language}`;
}

for (const width of [320, 375, 768, 1280]) {
  test(`room guide is collapsed and responsive at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(roomUrl('en'));

    const manual = page.locator('#roomManual');
    const summary = manual.locator('summary');
    await expect(manual).toBeVisible();
    await expect(manual).not.toHaveAttribute('open', '');
    await expect(summary).toContainText('Guide & Features');
    await expect(summary).toHaveAccessibleName('Guide & Features');
    await expect(page.locator('.knowledge-bites, .kb')).toHaveCount(0);

    for (const theme of ['light', 'dark', 'system'] as const) {
      for (const style of ['dev', 'clean'] as const) {
        await page.evaluate(({ theme, style }) => {
          const ui = (window as typeof window & {
            PPUI: { setTheme: (value: string) => void; setUiStyle: (value: string) => void };
          }).PPUI;
          ui.setTheme(theme);
          ui.setUiStyle(style);
        }, { theme, style });
        await summary.click();
        await expect(manual).toHaveAttribute('open', '');
        expect(await manual.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
        await summary.click();
        await expect(manual).not.toHaveAttribute('open', '');
      }
    }
  });
}

test('room guide supports keyboard operation and exposes its content', async ({ page }) => {
  await page.goto(roomUrl('en'));
  const manual = page.locator('#roomManual');
  const summary = manual.locator('summary');
  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(manual).toHaveAttribute('open', '');
  await expect(page.locator('.room-manual-body section')).toHaveCount(6);
  await expect(page.locator('[data-i18n="manual.exit.body"]')).toContainText('Close room for everyone');
  await page.keyboard.press('Space');
  await expect(manual).not.toHaveAttribute('open', '');
});

test('German room guide has translated heading and matching sections', async ({ page }) => {
  await page.goto(roomUrl('de'));
  const manual = page.locator('#roomManual');
  await expect(manual.locator('summary')).toContainText('Anleitung & Funktionen');
  await manual.locator('summary').click();
  await expect(page.locator('.room-manual-body section')).toHaveCount(6);
  await expect(page.locator('[data-i18n="manual.exit.body"]')).toContainText('Raum für alle schließen');
});
