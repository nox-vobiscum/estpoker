// tests/reconnect-state.spec.ts
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

test('Refresh after reset shows pre-vote UI for a non-host', async ({ browser }) => {
  const room = newRoomCode('RECO');
  const ctxHost = await browser.newContext();
  const ctxGuest = await browser.newContext();
  const host = await ctxHost.newPage();
  const guest = await ctxGuest.newPage();

  await host.goto(roomUrlFor('Host', room), { waitUntil: 'domcontentloaded' });
  await guest.goto(roomUrlFor('Guest', room), { waitUntil: 'domcontentloaded' });

  await setSequence(host, 'fib.scrum');
  await Promise.all([waitSeq(host, 'fib.scrum'), waitSeq(guest, 'fib.scrum')]);

  expect(await voteAnyNumber(host)).toBeTruthy();
  expect(await voteAnyNumber(guest)).toBeTruthy();

  expect(await revealNow(host)).toBe(true);
  expect(await resetNow(host)).toBe(true);

  await guest.reload({ waitUntil: 'domcontentloaded' });
  expect(await waitPreVote(guest, 3000)).toBe(true);

  await ctxHost.close();
  await ctxGuest.close();
});
