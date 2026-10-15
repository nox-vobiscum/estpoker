import { expect, test } from '@playwright/test';

for (const { width, height } of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 667, height: 375 }]) {
  test(`mobile content and controls remain reachable at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    for (const path of ['/', '/about', '/invite?roomCode=mobile-check', `/room?roomCode=mobile-${width}-${height}-${Date.now()}&participantName=Host`]) {
      await page.goto(path);
      const trigger = page.locator('#menuButton');
      await expect(trigger).toBeVisible();
      await expect(page.locator('.app-header button:visible')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

      if (path.startsWith('/room')) {
        await expect(page.locator('body')).toHaveClass(/is-host/);
        await expect(page.locator('#cardGrid button').first()).toBeVisible();
        await expect(page.locator('.room-manual')).toBeVisible();
      }

      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForFunction(() => Math.abs(scrollY + innerHeight - document.documentElement.scrollHeight) <= 2);
      const footer = page.locator('.app-footer');
      await expect(footer).toBeInViewport();
      const footerBox = await footer.boundingBox();
      expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(height + 1);
      if (path.startsWith('/room')) {
        const lastContent = page.locator('.room-manual');
        await expect(lastContent).toBeVisible();
        const lastBox = await lastContent.boundingBox();
        expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(footerBox!.y + 1);
        const action = page.locator('#revealButton:visible, #resetButton:visible');
        const actionBox = await action.boundingBox();
        if (width <= 600) {
          expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(footerBox!.y);
          expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(actionBox!.y);
        }
        await page.locator('#copyRoomLink').scrollIntoViewIfNeeded();
        const copyBox = await page.locator('#copyRoomLink').boundingBox();
        expect(copyBox!.width).toBeGreaterThanOrEqual(40);
        expect(copyBox!.height).toBeGreaterThanOrEqual(40);
        expect(await page.locator('#copyRoomLink').evaluate(button => {
          const rect = button.getBoundingClientRect();
          const painted = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return painted === button || button.contains(painted);
        })).toBe(true);
      }

      await trigger.click();
      const panel = page.getByRole('dialog');
      await expect(panel).toBeVisible();
      expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      const panelBox = await panel.boundingBox();
      expect(panelBox!.y).toBeGreaterThanOrEqual(0);
      expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(height + 1);
      if (path.startsWith('/room')) {
        await page.locator('#closeRoomBtn').scrollIntoViewIfNeeded();
        await expect(page.locator('#closeRoomBtn')).toBeInViewport();
        await expect(page.locator('#menuCloseButton')).toBeInViewport();
      }
      await page.locator('#menuCloseButton').click();
    }
    await page.screenshot({ path: testInfo.outputPath('room-mobile.png'), fullPage: true });
  });
}
