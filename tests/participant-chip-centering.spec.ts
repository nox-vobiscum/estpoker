import { test, expect, type Locator, type Page } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

async function centerX(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return box.x + box.width / 2;
}

async function setChipAnimationTime(page: Page, locator: Locator, time: number) {
  await locator.evaluate((element, currentTime) => {
    const animation = element.getAnimations().find(item => (item as CSSAnimation).animationName === 'chipIn');
    if (animation) {
      animation.pause();
      animation.currentTime = currentTime;
    }
  }, time);
}

for (const width of [320, 375, 1280]) {
  test(`vote chip keeps its horizontal position through reveal and reset at ${width}px`, async ({ browser }) => {
    const room = newRoomCode('CHIPCENTER');
    const hostContext = await browser.newContext({ viewport: { width, height: 900 } });
    const guestContext = await browser.newContext({ viewport: { width, height: 900 } });
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    try {
      await host.goto(roomUrlFor('ChipHost', room));
      await expect(host.locator('#liveParticipantList .host-label')).toHaveCount(1);
      await guest.goto(roomUrlFor('ChipGuest', room));
      await expect(host.locator('#liveParticipantList .participant-row')).toHaveCount(2);

      const hostRow = host.locator('#liveParticipantList .participant-row').filter({ hasText: 'ChipHost' });
      const pending = hostRow.locator('.mini-chip');
      await expect(pending).toBeVisible();
      await expect(pending).toHaveText('⏳');
      const pendingVisual = await pending.evaluate(element => {
        const chip = getComputedStyle(element);
        const icon = getComputedStyle(element, '::before');
        return {
          fontSize: chip.fontSize,
          fontFamily: chip.fontFamily,
          boxShadow: chip.boxShadow,
          iconWidth: icon.width,
          iconHeight: icon.height,
          iconMask: icon.maskImage || (icon as CSSStyleDeclaration & { webkitMaskImage?: string }).webkitMaskImage,
        };
      });
      expect(pendingVisual.fontSize).toBe('0px');
      expect(pendingVisual.fontFamily).not.toMatch(/Emoji/i);
      expect(pendingVisual.boxShadow).toBe('none');
      expect(pendingVisual.iconWidth).toBe('14px');
      expect(pendingVisual.iconHeight).toBe('14px');
      expect(pendingVisual.iconMask).toContain('data:image/svg+xml');
      const expectedCenter = await centerX(pending);
      if (width === 1280) expect(Math.abs(expectedCenter - await centerX(hostRow))).toBeLessThanOrEqual(1);

      await host.locator('#cardGrid button[data-value="3"]').click();
      await guest.locator('#cardGrid button[data-value="8"]').click();
      await host.locator('#revealButton').click();
      const chip = hostRow.locator('.vote-chip');
      await expect(chip).toBeVisible();
      for (const time of [0, 110, 220]) {
        await setChipAnimationTime(host, chip, time);
        expect(Math.abs(await centerX(chip) - expectedCenter)).toBeLessThanOrEqual(1);
      }

      await host.locator('#resetButton').click();
      await expect(pending).toBeVisible();
      expect(Math.abs(await centerX(pending) - expectedCenter)).toBeLessThanOrEqual(1);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
}
