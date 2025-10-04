// tests/reset-flow.spec.ts
// After reveal, Reset clears chips and restores pre-vote UI

import { test, expect } from '@playwright/test';
import {
  roomUrlFor,
  newRoomCode,
  pickTwoNumeric,
  clickByValue,
  revealNow,
  resetNow,
  waitPreVote,
  setSequence,
  waitSeq,
  revealedNow,
} from './utils/helpers';

test('After reveal, Reset clears chips and restores pre-vote UI', async ({ browser }) => {
  const room = newRoomCode('RESET');

  const ctxHost = await browser.newContext();
  const ctxGuest = await browser.newContext();
  const host = await ctxHost.newPage();
  const guest = await ctxGuest.newPage();

  await host.goto(roomUrlFor('Host', room), { waitUntil: 'domcontentloaded' });
  await guest.goto(roomUrlFor('Guest', room), { waitUntil: 'domcontentloaded' });

  // Ensure both pages are on a numeric-friendly deck
  await setSequence(host, 'fib.scrum');
  await Promise.all([
    waitSeq(host, 'fib.scrum'),
    waitSeq(guest, 'fib.scrum'),
  ]);

  // Vote
  const pair = await pickTwoNumeric(host);
  expect(pair).not.toBeNull();
  const [a, b] = pair!;
  expect(await clickByValue(host, a)).toBeTruthy();
  expect(await clickByValue(guest, b)).toBeTruthy();

  // If AR already fired, skip manual reveal; otherwise click it
  const alreadyRevealed = await revealedNow(host, 800);
  if (!alreadyRevealed) {
    await expect(host.locator('#revealButton')).toBeEnabled({ timeout: 3000 });
    expect(await revealNow(host)).toBe(true);
  }

  // Reset and assert pre-vote
  expect(await resetNow(host)).toBe(true);
  expect(await waitPreVote(host, 3000)).toBe(true);
  expect(await waitPreVote(guest, 3000)).toBe(true);

  await ctxHost.close();
  await ctxGuest.close();
});
