import { test, expect, type Page } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

async function enterRoom(page: Page, name: string, code: string) {
  await page.goto(roomUrlFor(name, code), { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('pp-room-return') || 'null')?.roomCode)).toBe(code);
}

test('returns from About and Home with the same room and identity', async ({ page }) => {
  const code = newRoomCode('RETURN');
  await enterRoom(page, 'Returner', code);
  await page.goto('/about');
  const link = page.locator('#roomReturnLink');
  await expect(link).toBeVisible();
  await expect(link).toContainText(code);
  await expect(link).toHaveAttribute('href', `/room?roomCode=${code}&participantName=Returner`);
  await page.reload();
  await expect(link).toBeVisible();
  await page.goto('/');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/room\\?roomCode=${code}&participantName=Returner$`));
  await expect(page.locator('#youName')).toHaveText('Returner');
  await expect(page.locator('#roomReturn')).toHaveCount(0);
  await page.goto('/');
  await expect(link).toBeVisible();
  await page.reload();
  await expect(link).toBeVisible();
});

test('separate tabs keep independent targets and a new tab has no return', async ({ browser }) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const second = await context.newPage();
  const firstCode = newRoomCode('FIRST');
  const secondCode = newRoomCode('SECOND');
  await enterRoom(first, 'First', firstCode);
  await enterRoom(second, 'Second', secondCode);
  await first.goto('/about');
  await second.goto('/');
  await expect(first.locator('#roomReturnLink')).toContainText(firstCode);
  await expect(second.locator('#roomReturnLink')).toContainText(secondCode);
  const fresh = await context.newPage();
  await fresh.goto('/about');
  await expect(fresh.locator('#roomReturn')).toBeHidden();
  await context.close();
});

test('a tab opened from an active room does not inherit its return action', async ({ page }) => {
  await enterRoom(page, 'Opener', newRoomCode('OPENER'));
  const popupPromise = page.waitForEvent('popup');
  await page.evaluate(() => window.open('/about', '_blank'));
  const popup = await popupPromise;
  await expect(popup.locator('#roomReturn')).toBeHidden();
});

test('closed room clears its return action', async ({ page }) => {
  const code = newRoomCode('CLOSED');
  await enterRoom(page, 'Host', code);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#menuButton').click();
  await page.locator('#closeRoomBtn').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#roomReturn')).toBeHidden();
});

test('duplicate-name invite does not offer an invalid return loop', async ({ browser }) => {
  const code = newRoomCode('DUPRETURN');
  const host = await browser.newContext();
  const guest = await browser.newContext();
  const hostPage = await host.newPage();
  const guestPage = await guest.newPage();
  await enterRoom(hostPage, 'Taken', code);
  await guestPage.goto(roomUrlFor('Taken', code), { waitUntil: 'domcontentloaded' });
  await expect(guestPage).toHaveURL(/\/invite\?.*nameTaken=1/);
  await expect(guestPage.locator('#roomReturn')).toBeHidden();
  await host.close();
  await guest.close();
});

for (const width of [320, 375, 768, 769, 1280]) {
  test(`return link remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    const code = newRoomCode('LONG') + '-a-very-long-room-name';
    await enterRoom(page, 'Keyboard', code);
    await page.goto('/about');
    const link = page.locator('#roomReturnLink');
    await expect(link).toBeInViewport();
    await link.focus();
    await expect(link).toBeFocused();
    const fits = await link.evaluate(element => element.getBoundingClientRect().right <= window.innerWidth);
    expect(fits).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/room\?/);
  });
}
