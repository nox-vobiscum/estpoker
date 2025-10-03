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
} from './utils/helpers';

test('After reveal, Reset clears chips and restores pre-vote UI', async ({ browser }) => {
  const room = newRoomCode('RESET');

  const ctxHost = await browser.newContext();
  const ctxGuest = await browser.newContext();
  const host = await ctxHost.newPage();
  const guest = await ctxGuest.newPage();

  await host.goto(roomUrlFor('Host', room), { waitUntil: 'domcontentloaded' });
  await guest.goto(roomUrlFor('Guest', room), { waitUntil: 'domcontentloaded' });

  // Ensure numeric-friendly deck
  await setSequence(host, 'fib.scrum');
  await waitSeq(host, 'fib.scrum');

  // Both vote
  const pair = await pickTwoNumeric(host);
  expect(pair).not.toBeNull();
  const [a, b] = pair!;
  expect(await clickByValue(host, a)).toBeTruthy();
  expect(await clickByValue(guest, b)).toBeTruthy();

  // Reveal via robust helper
  expect(await revealNow(host)).toBe(true);

  // Now reset and verify pre-vote state is restored
  expect(await resetNow(host)).toBe(true);
  expect(await waitPreVote(host, 3000)).toBe(true);
  expect(await waitPreVote(guest, 3000)).toBe(true);

  await ctxHost.close();
  await ctxGuest.close();
});
