import { test, expect, chromium, firefox } from '@playwright/test';

// Compare the same controls and state across engines, not font rasterization.
for (const width of [375, 768, 1280]) {
  for (const theme of ['light', 'dark']) {
    for (const style of ['dev', 'clean']) {
      test(`control geometry ${style}/${theme} at ${width}px`, async ({ baseURL }, testInfo) => {
        const measurements: Record<string, any[]> = {};
        for (const [engineName, engine] of Object.entries({ chromium, firefox })) {
          const browser = await engine.launch();
          try {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            await page.addInitScript(({ theme, style }) => {
              localStorage.setItem('estpoker-theme', theme);
              localStorage.setItem('ep-ui-style', style);
            }, { theme, style });
            await page.goto(`${baseURL}/room?roomCode=geometry-${engineName}-${Date.now()}&participantName=Host`);
            const cards = page.locator('#cardGrid button');
            await expect(cards.first()).toBeVisible();
            await expect(page.locator('#liveParticipantList .participant-row')).toHaveCount(1);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            const cardSizes = await page.evaluate(() => Array.from(document.querySelectorAll('#cardGrid button'), el => {
              const rect = el.getBoundingClientRect();
              return { width: rect.width, height: rect.height };
            }));
            // Short labels must not collapse into intrinsic-width native buttons.
            for (const size of cardSizes) {
              expect(size.width).toBeGreaterThan(35);
              expect(Math.abs(size.width - cardSizes[0]!.width)).toBeLessThan(1);
              if (style === 'clean') expect(size.height).toBeGreaterThanOrEqual(48);
            }
            await page.screenshot({ path: testInfo.outputPath(`${engineName}-room.png`), fullPage: true });
            await page.locator('#menuButton').click();
            await expect(page.locator(style === 'dev' ? '#uiStyleDev' : '#uiStyleClean')).toHaveAttribute('aria-pressed', 'true');
            await page.locator('#uiStyleClean').focus();
            await page.keyboard.press('Shift+Tab');
            await expect(page.locator('#uiStyleDev')).toHaveCSS('outline-style', 'solid');
            await page.mouse.move(0, 0);
            // Query and measure atomically: WebSocket updates can replace card nodes.
            measurements[engineName] = await page.evaluate(() => Array.from(document.querySelectorAll('#cardGrid button,#revealButton,#menuButton,#copyRoomLink,#uiStyleDev,#uiStyleClean'), el => {
              const css = getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return { label: el.id || el.textContent, width: rect.width, height: rect.height, radius: css.borderRadius, appearance: css.appearance };
            }));
            await page.screenshot({ path: testInfo.outputPath(`${engineName}-menu.png`) });
          } finally {
            await browser.close();
          }
        }
        expect(measurements.chromium!.length).toBe(measurements.firefox!.length);
        measurements.chromium!.forEach((control, index) => {
          const other = measurements.firefox![index];
          expect(control.appearance).toBe('none');
          expect(other.appearance, `${other.label}: ${JSON.stringify(other)}`).toBe('none');
          expect(other.radius).toBe(control.radius);
          expect(Math.abs(other.width - control.width)).toBeLessThan(2);
          expect(Math.abs(other.height - control.height)).toBeLessThan(2);
        });
      });
    }
  }
}
