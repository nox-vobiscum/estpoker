import { test, expect } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

for (const mode of ['light', 'dark', 'system-light', 'system-dark']) {
  test(`return chip: ${mode}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: mode.endsWith('dark') ? 'dark' : 'light' });
    await page.addInitScript(({ mode }) => {
      localStorage.setItem('planningpoker-theme', mode.startsWith('system') ? 'system' : mode);
    }, { mode });
    const room = newRoomCode('CHIP') + '-long-room-name-for-mobile-ellipsis';
    await page.goto(roomUrlFor('Returner', room));
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('pp-room-return') || 'null')?.roomCode)).toBe(room);
    for (const [width, lang] of [[320, 'de'], [1280, 'en']] as const) {
      await page.setViewportSize({ width, height: 800 });
      let position: { x: number; y: number } | undefined;
      for (const path of ['/', '/about', '/invite', '/imprint']) {
        await page.goto(path);
        // Consume the existing preference API; navigation state remains untouched.
        await page.evaluate(lang => (window as any).PPUI.setLanguage(lang), lang);
        const link = page.locator('#roomReturnLink');
        const name = page.locator('#roomReturnName');
        await expect(link).toHaveAccessibleName(`${lang === 'de' ? 'Zurück zu Raum' : 'Return to room'} ${room}`);
        await expect(name).toHaveText(room);
        await expect(link).toHaveAttribute('href', `/room?roomCode=${room}&participantName=Returner`);
        await expect(link).toBeInViewport();
        await expect(link).toHaveCSS('text-decoration-line', 'none');
        await expect(name).toHaveCSS('text-overflow', 'ellipsis');
        if (width === 320) expect(await name.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
        const box = (await link.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(40);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        if (position) {
          expect(box.x).toBeCloseTo(position.x, 1);
          expect(box.y).toBeCloseTo(position.y, 1);
        }
        position = box;
        const background = await link.evaluate(el => getComputedStyle(el).backgroundColor);
        await link.hover();
        await expect(link).toHaveCSS('text-decoration-line', 'none');
        expect(await link.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(background);
        await page.mouse.down();
        await expect(link).toHaveCSS('text-decoration-line', 'none');
        await page.mouse.move(0, 0);
        await page.mouse.up();
        await page.keyboard.press('Tab');
        await link.focus();
        await expect(link).toBeFocused();
        await expect(link).toHaveCSS('outline-style', 'solid');
        await expect(link).toHaveCSS('text-decoration-line', 'none');
        if (path === '/imprint') await link.screenshot({ path: testInfo.outputPath(`chip-${width}.png`) });
      }
    }
  });
}
