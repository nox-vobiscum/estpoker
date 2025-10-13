// tests/result-aria-clear-on-hide.spec.ts
import { test, expect } from '@playwright/test';
import {
  newRoomCode,
  waitAppReady,
  waitHostRole,
  clickByValue,
  revealNow,
  resetNow,
  waitPreVote,
} from './utils/helpers';

test('SR announcement clears after Reset (votes hidden again)', async ({ browser }) => {
  const room = newRoomCode('SRC');
  const hostName = 'HostClear';
  const guestName = 'GuestClear';

  const ctx = await browser.newContext();
  const host = await ctx.newPage();
  const guest = await ctx.newPage();

  await host.goto(
    `/room?roomCode=${encodeURIComponent(room)}&participantName=${encodeURIComponent(hostName)}`,
    { waitUntil: 'domcontentloaded' }
  );
  await guest.goto(
    `/room?roomCode=${encodeURIComponent(room)}&participantName=${encodeURIComponent(guestName)}`,
    { waitUntil: 'domcontentloaded' }
  );

  await waitAppReady(host);
  await waitAppReady(guest);
  await waitHostRole(host);

  // Different votes to produce non-empty stats
  await clickByValue(host, '3');
  await clickByValue(guest, '5');

  // Reveal → SR announces
  await revealNow(host);
  const sr = host.locator('#resultAnnounce');
  await expect(sr).not.toHaveText('');

  // Reset via robust helper
  await resetNow(host);
  await expect(await waitPreVote(host)).toBe(true);

  // SR text must be empty again while results are hidden
  const resultRow = host.locator('#resultRow');
  await expect(resultRow).toHaveClass(/is-hidden/);
  await expect(sr).toHaveText('');

  await ctx.close();
});
