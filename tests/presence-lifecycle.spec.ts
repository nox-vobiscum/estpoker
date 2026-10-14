import { test, expect } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

async function participantState(page: any, name: string) {
  return page.locator('#liveParticipantList .participant-row').filter({ has: page.locator('.name', { hasText: name }) });
}

test('join and reconnect stay active while a real disconnect still sleeps', async ({ browser }) => {
  const room = newRoomCode('PRESENCE');
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  let guestSockets = 0;
  guest.on('websocket', () => guestSockets++);

  await host.goto(roomUrlFor('HostAudit', room));
  await guest.goto(roomUrlFor('GuestAudit', room));
  const row = await participantState(host, 'GuestAudit');
  await expect(row).toBeVisible();
  await expect(row).not.toHaveClass(/disconnected/);
  await host.waitForTimeout(3_000);
  await expect(row).not.toHaveClass(/disconnected/);
  expect(guestSockets).toBe(1);

  await guest.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await guest.waitForTimeout(500);
  expect(guestSockets).toBe(1);
  await expect(row).not.toHaveClass(/disconnected/);

  await guest.evaluate(() => (window as any).__ppWs.close(4002, 'presence-test'));
  await expect.poll(() => guestSockets, { timeout: 5_000 }).toBeGreaterThan(1);
  await host.waitForTimeout(3_000);
  await expect(row).not.toHaveClass(/disconnected/);

  await guestContext.close();
  await expect(row).toHaveClass(/disconnected/, { timeout: 4_500 });
  await hostContext.close();
});

test('heartbeat keeps an idle participant active without creating another socket', async ({ browser }) => {
  const room = newRoomCode('HEARTBEAT');
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  let guestSockets = 0;
  guest.on('websocket', () => guestSockets++);

  await host.goto(roomUrlFor('HeartbeatHost', room));
  await guest.goto(roomUrlFor('HeartbeatGuest', room));
  const row = await participantState(host, 'HeartbeatGuest');
  await expect(row).toBeVisible();
  await host.waitForTimeout(16_500);
  await expect(row).not.toHaveClass(/disconnected/);
  expect(guestSockets).toBe(1);

  await guestContext.close();
  await hostContext.close();
});
