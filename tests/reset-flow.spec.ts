// tests/reset-flow.spec.ts
// After reveal, Reset clears chips and restores pre-vote UI

import { test, expect } from '@playwright/test';
import {
  roomUrlFor,
  newRoomCode,
  voteAnyNumber,
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

  await setSequence(host, 'fib.scrum');
  await Promise.all([waitSeq(host, 'fib.scrum'), waitSeq(guest, 'fib.scrum')]);

  // Robust: irgendeine Zahl auf beiden Seiten
  expect(await voteAnyNumber(host)).toBeTruthy();
  expect(await voteAnyNumber(guest)).toBeTruthy();

  expect(await revealNow(host)).toBe(true);

  // Reset and assert pre-vote
  expect(await resetNow(host)).toBe(true);
  expect(await waitPreVote(host, 3000)).toBe(true);
  expect(await waitPreVote(guest, 3000)).toBe(true);

  await ctxHost.close();
  await ctxGuest.close();
});
