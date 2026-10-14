import { test, expect } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

for (const width of [375, 1280]) {
  for (const consensus of [true, false]) {
    test(`result and card grid share center at ${width}px (${consensus ? 'consensus' : 'statistics'})`, async ({ browser }) => {
      const room = newRoomCode('ALIGN');
      const hostContext = await browser.newContext({ viewport: { width, height: 900 } });
      const guestContext = await browser.newContext({ viewport: { width, height: 900 } });
      const host = await hostContext.newPage();
      const guest = await guestContext.newPage();
      try {
        await host.goto(roomUrlFor('AlignHost', room));
        await expect(host.locator('#liveParticipantList .host-label')).toHaveCount(1);
        await guest.goto(roomUrlFor('AlignGuest', room));
        await expect(host.locator('#liveParticipantList .participant-row')).toHaveCount(2);

        await host.locator('#cardGrid button[data-value="3"]').click();
        await guest.locator(`#cardGrid button[data-value="${consensus ? '3' : '8'}"]`).click();
        await host.locator('#revealButton').click();
        const result = host.locator('#resultRow');
        await expect(result).not.toHaveClass(/is-hidden/);
        if (consensus) {
          await expect(result).toHaveClass(/consensus/);
        } else {
          await expect(host.locator('#medianWrap')).toBeVisible();
          await expect(host.locator('#rangeWrap')).toBeVisible();
        }

        const centers = await host.evaluate(() => {
          const resultBox = document.querySelector('#resultRow')!.getBoundingClientRect();
          const gridBox = document.querySelector('#cardGrid')!.getBoundingClientRect();
          return {
            result: resultBox.left + resultBox.width / 2,
            grid: gridBox.left + gridBox.width / 2,
          };
        });
        expect(Math.abs(centers.result - centers.grid)).toBeLessThanOrEqual(1);
        expect(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      } finally {
        await hostContext.close();
        await guestContext.close();
      }
    });
  }
}
