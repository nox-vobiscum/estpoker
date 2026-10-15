import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

const participantRow = (page: Page, name: string) => page.locator('#liveParticipantList .participant-row').filter({ has: page.locator('.name', { hasText: new RegExp(`^${name}$`) }) });

for (const width of [320, 1280]) {
  test(`header, roster roles and dense room remain responsive at ${width}px`, async ({ browser }, testInfo) => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    try {
      for (let i = 0; i < 5; i++) {
        const context = await browser.newContext({ viewport: { width, height: 800 } });
        contexts.push(context);
        const page = await context.newPage();
        pages.push(page);
      }
      const host = pages[0]!;
      const spectator = pages[1]!;
      const inactive = pages[2]!;
      const guestThree = pages[3]!;
      const guestFour = pages[4]!;
      const room = newRoomCode('RESPONSIVE');
      await host.goto(roomUrlFor('Host', room));
      await expect(participantRow(host, 'Host')).toHaveClass(/is-host/);
      for (const [page, name] of [[spectator, 'Spectator'], [inactive, 'Inactive'], [guestThree, 'GuestThree'], [guestFour, 'GuestFour']] as const) {
        await page.goto(roomUrlFor(name, room));
      }
      await expect(host.locator('#liveParticipantList .participant-row')).toHaveCount(5);

      await participantRow(host, 'Spectator').locator('.participant-more').click();
      await host.getByRole('menuitem', { name: 'Make spectator', exact: true }).click();
      await expect(participantRow(host, 'Spectator')).toHaveClass(/spectator/);
      await contexts[2]!.close();
      await expect(participantRow(host, 'Inactive')).toHaveClass(/disconnected/, { timeout: 5_000 });
      await expect(participantRow(host, 'Inactive').locator('.participant-role-inactive')).toHaveCount(1);

      if (width <= 768) {
        await expect(host.locator('.app-header button:visible')).toHaveCount(1);
        await expect(host.locator('.desktop-language:visible, .desktop-theme:visible')).toHaveCount(0);
      } else {
        await expect(host.locator('.desktop-language')).toBeVisible();
        await expect(host.locator('.desktop-theme')).toBeVisible();
      }
      await host.locator('#menuButton').click();
      if (width <= 768) await expect(host.locator('#menuLanguageHeading')).toBeVisible();
      else await expect(host.locator('#menuLanguageHeading')).toBeHidden();
      await expect(host.locator('#menuTheme')).toBeVisible();
      await host.locator('#menuCloseButton').click();

      await expect(host.locator('.participant-more')).toHaveCount(4);
      await expect(spectator.locator('.participant-more')).toHaveCount(0);
      const finalTrigger = participantRow(host, 'GuestFour').locator('.participant-more');
      await finalTrigger.click();
      await expect(host.getByRole('menu')).toBeVisible();
      const geometry = await host.evaluate(() => {
        const menu = document.querySelector('.participant-action-menu')!.getBoundingClientRect();
        const rows = Array.from(document.querySelectorAll('#liveParticipantList .participant-row')).map(row => row.getBoundingClientRect());
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          menuInside: menu.left >= 0 && menu.right <= innerWidth && menu.top >= 0 && menu.bottom <= innerHeight,
          rowsInside: rows.every(row => row.left >= 0 && row.right <= innerWidth),
        };
      });
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      expect(geometry.menuInside).toBe(true);
      expect(geometry.rowsInside).toBe(true);
      await host.screenshot({ path: testInfo.outputPath(`responsive-${width}.png`), fullPage: true });
    } finally {
      await Promise.all(contexts.map(context => context.close().catch(() => {})));
    }
  });
}
