import { test, expect } from '@playwright/test';
import { newRoomCode } from './utils/env';

const longTopic = 'A deliberately long estimation topic that must remain readable and wrap across narrow screens without hiding any part of the title';
const ticketUrl = 'https://example.com/browse/PLAN-123?source=planning-poker';

async function openTopic(page: import('@playwright/test').Page, language: 'de' | 'en') {
  await page.goto(`/room?roomCode=${newRoomCode('PNL')}&participantName=Host&lang=${language}`, {
    waitUntil: 'domcontentloaded'
  });
  await expect(page.locator('body')).toHaveClass(/is-host/);
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('pp:topic-toggle', { detail: { on: true } }));
  });
  await expect(page.locator('#topicRow')).toBeVisible();
}

async function saveTopic(page: import('@playwright/test').Page, value: string) {
  await page.locator('#topicEditBtn').click();
  await page.locator('#topicDisplay').fill(value);
  await page.locator('#topicSaveBtn').click();
}

for (const width of [375, 1280]) {
  test(`Topic panel wraps without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openTopic(page, 'en');
    await saveTopic(page, longTopic);

    await expect(page.locator('#topicPanelHeading')).toHaveText('CURRENT ESTIMATION TOPIC');
    await expect(page.locator('#topicDisplay')).toHaveText(longTopic);
    await expect(page.locator('.topic-panel-icon')).toBeVisible();
    await expect(page.locator('#topicEditBtn')).toHaveAccessibleName(/Edit/i);
    await expect(page.locator('#topicClearBtn')).toHaveAccessibleName(/Clear/i);

    for (const [theme, style] of [['light', 'dev'], ['light', 'clean'], ['dark', 'dev'], ['dark', 'clean']] as const) {
      await page.evaluate(({ nextTheme, nextStyle }) => {
        const ui = (window as typeof window & {
          PPUI: { setTheme: (value: string) => void; setUiStyle: (value: string) => void };
        }).PPUI;
        ui.setTheme(nextTheme);
        ui.setUiStyle(nextStyle);
      }, { nextTheme: theme, nextStyle: style });
      const geometry = await page.locator('#topicRow').evaluate((row) => ({
        rowOverflow: row.scrollWidth - row.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        lines: Math.round((document.querySelector('#topicDisplay')!.getBoundingClientRect().height) /
          parseFloat(getComputedStyle(document.querySelector('#topicDisplay')!).lineHeight))
      }));
      expect(geometry.rowOverflow, `${theme}/${style} topic overflow`).toBeLessThanOrEqual(1);
      expect(geometry.pageOverflow, `${theme}/${style} page overflow`).toBeLessThanOrEqual(1);
      if (width === 375) expect(geometry.lines, `${theme}/${style} wrapped lines`).toBeGreaterThan(1);
    }
  });
}

test('German heading and external ticket link are exposed correctly', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await openTopic(page, 'de');
  await saveTopic(page, ticketUrl);

  await expect(page.locator('#topicPanelHeading')).toHaveText('AKTUELLES SCHÄTZTHEMA');
  const link = page.locator('#topicTicketLink');
  await expect(link).toBeVisible();
  await expect(link).toHaveText('Ticket öffnen');
  await expect(link).toHaveAttribute('href', ticketUrl);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
});
