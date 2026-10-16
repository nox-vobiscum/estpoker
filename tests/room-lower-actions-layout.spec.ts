import { expect, test, type Page } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

async function expectReachableAboveFooter(page: Page, selector: string) {
  const reachable = await page.locator(selector).evaluate(element => {
    element.scrollIntoView({ block: 'center' });
    const rect = element.getBoundingClientRect();
    const footer = document.querySelector('.app-footer')!.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= footer.top + 1;
  });
  expect(reachable, selector).toBe(true);
}

for (const width of [375, 393, 1280]) {
  test(`room actions keep the requested order and center line at ${width}px`, async ({ browser }) => {
    test.setTimeout(45_000);
    const hostContext = await browser.newContext({ viewport: { width, height: 852 } });
    const guestContext = await browser.newContext({ viewport: { width, height: 852 } });
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const room = newRoomCode('LOWER');
    try {
      await host.goto(roomUrlFor('Host', room));
      await guest.goto(roomUrlFor('Guest', room));
      await expect(host.locator('#liveParticipantList .participant-row')).toHaveCount(2);
      await expect(host.locator('#revealButton')).toBeVisible();
      await expect(guest.locator('#revealButton:visible,#resetButton:visible')).toHaveCount(0);
      await expect(host.locator('#leaveRoomBtn')).toBeVisible();
      await expect(guest.locator('#leaveRoomBtn')).toBeVisible();
      await expect(host.locator('#roomManual')).not.toHaveAttribute('open', '');
      await expect(guest.locator('#roomManual')).not.toHaveAttribute('open', '');

      for (const page of [host, guest]) {
        const layout = await page.evaluate(() => {
          const cards = document.querySelector('#cardGrid')!.getBoundingClientRect();
          const action = document.querySelector<HTMLElement>('#revealButton:not([hidden]),#resetButton:not([hidden])')?.getBoundingClientRect();
          const leave = document.querySelector('#leaveRoomBtn')!.getBoundingClientRect();
          const exitRow = document.querySelector('.room-exit-row')!;
          const manual = document.querySelector('.room-manual')!.getBoundingClientRect();
          const separator = getComputedStyle(exitRow, '::before');
          return {
            cardsCenter: cards.left + cards.width / 2,
            actionCenter: action ? action.left + action.width / 2 : null,
            actionWidth: action?.width ?? null,
            leaveCenter: leave.left + leave.width / 2,
            leaveWidth: leave.width,
            order: action
              ? cards.bottom <= action.top && action.bottom <= leave.top && leave.bottom <= manual.top
              : cards.bottom <= leave.top && leave.bottom <= manual.top,
            separatorWidth: parseFloat(separator.width),
            separatorBorder: separator.borderTopWidth,
            overflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
        expect(layout.order).toBe(true);
        expect(Math.abs(layout.cardsCenter - layout.leaveCenter)).toBeLessThanOrEqual(1);
        if (layout.actionCenter !== null) expect(Math.abs(layout.cardsCenter - layout.actionCenter)).toBeLessThanOrEqual(1);
        expect(layout.separatorWidth).toBeGreaterThan(0);
        expect(layout.separatorBorder).toBe('1px');
        expect(layout.overflow).toBeLessThanOrEqual(1);
        if (width > 600) {
          if (layout.actionWidth !== null) {
            expect(layout.actionWidth).toBeGreaterThanOrEqual(220);
            expect(layout.actionWidth).toBeLessThanOrEqual(260);
          }
          expect(layout.leaveWidth).toBeGreaterThanOrEqual(180);
          expect(layout.leaveWidth).toBeLessThanOrEqual(220);
        }
        await expectReachableAboveFooter(page, '#leaveRoomBtn');
        await expectReachableAboveFooter(page, '#roomManual');
      }
      await expectReachableAboveFooter(host, '#revealButton');

      await host.locator('#cardGrid button[data-value="3"]').click();
      await guest.locator('#cardGrid button[data-value="3"]').click();
      await host.locator('#revealButton').click();
      await expect(host.locator('#resetButton')).toBeVisible();
      const reset = await host.locator('#resetButton').boundingBox();
      const cards = await host.locator('#cardGrid').boundingBox();
      expect(Math.abs((reset!.x + reset!.width / 2) - (cards!.x + cards!.width / 2))).toBeLessThanOrEqual(1);
      await expectReachableAboveFooter(host, '#resetButton');
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
}
