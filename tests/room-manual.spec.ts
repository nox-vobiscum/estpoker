import { expect, test } from '@playwright/test';
import { newRoomCode } from './utils/env';

function roomUrl(language: 'de' | 'en') {
  return `/room?roomCode=${newRoomCode('GUIDE')}&participantName=Host&lang=${language}`;
}

for (const width of [320, 375, 393, 768, 1280]) {
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
      await page.evaluate(({ theme }) => {
        const ui = (window as typeof window & {
          PPUI: { setTheme: (value: string) => void };
        }).PPUI;
        ui.setTheme(theme);
      }, { theme });
      await summary.click();
      await expect(manual).toHaveAttribute('open', '');
      expect(await manual.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await summary.click();
      await expect(manual).not.toHaveAttribute('open', '');
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
  await expect(page.locator('.room-manual-body section')).toHaveCount(8);
  await expect(page.locator('[data-i18n="manual.results.consensus"]')).toContainText('no infinity card');
  await expect(page.locator('[data-i18n="manual.topic.autoreveal"]')).toContainText('numeric card');
  await expect(page.locator('[data-i18n="manual.exit.close"]')).toContainText('Close room for everyone');
  await page.keyboard.press('Space');
  await expect(manual).not.toHaveAttribute('open', '');
});

test('result definitions use the compact guide typography', async ({ page }) => {
  await page.goto(roomUrl('en'));
  await page.locator('#roomManual > summary').click();

  const typography = await page.locator('[data-i18n="manual.results.average"]').evaluate(element => {
    const style = getComputedStyle(element);
    return { fontSize: style.fontSize, lineHeight: style.lineHeight };
  });
  const bodyTypography = await page.locator('[data-i18n="manual.results.intro"]').evaluate(element => {
    const style = getComputedStyle(element);
    return { fontSize: style.fontSize, lineHeight: style.lineHeight };
  });
  const listStyle = await page.locator('[data-i18n="manual.results.average"]').evaluate(element =>
    getComputedStyle(element).listStyleType
  );

  expect(typography).toEqual(bodyTypography);
  expect(listStyle).toBe('disc');
});

test('result section spans both guide columns on desktop only', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(roomUrl('en'));
  await page.locator('#roomManual > summary').click();

  const desktop = await page.locator('.room-manual-body').evaluate(body => {
    const container = body.getBoundingClientRect();
    const result = body.querySelector('section:nth-child(3)')!.getBoundingClientRect();
    return { containerWidth: container.width, resultWidth: result.width };
  });
  expect(Math.abs(desktop.containerWidth - desktop.resultWidth)).toBeLessThanOrEqual(32);

  await page.setViewportSize({ width: 375, height: 800 });
  const mobileColumn = await page.locator('.room-manual-body section:nth-child(3)').evaluate(element =>
    getComputedStyle(element).gridColumn
  );
  expect(mobileColumn).toBe('auto');
});

test('German room guide has translated heading and matching sections', async ({ page }) => {
  await page.goto(roomUrl('de'));
  const manual = page.locator('#roomManual');
  await expect(manual.locator('summary')).toContainText('Anleitung & Funktionen');
  await manual.locator('summary').click();
  await expect(page.locator('.room-manual-body section')).toHaveCount(8);
  await expect(page.locator('[data-i18n="manual.results.consensus"]')).toContainText('keine Unendlich-Karte');
  await expect(page.locator('[data-i18n="manual.topic.autoreveal"]')).toContainText('numerische Karte');
  await expect(page.locator('[data-i18n="manual.exit.close"]')).toContainText('Raum für alle schließen');
});

test('room guide updates all sections when switching languages', async ({ page }) => {
  await page.goto(roomUrl('en'));
  const manual = page.locator('#roomManual');
  await manual.locator('summary').click();

  await page.evaluate(() => (window as typeof window & {
    PPUI: { setLanguage: (value: string) => Promise<string> };
  }).PPUI.setLanguage('de'));

  await expect(manual.locator('summary')).toContainText('Anleitung & Funktionen');
  await expect(page.locator('.room-manual-body section')).toHaveCount(8);
  await expect(page.locator('[data-i18n="manual.appearance.title"]')).toHaveText('Sprache und Darstellung');
  await expect(page.locator('.room-manual-body')).not.toContainText(/manual\./);
});
