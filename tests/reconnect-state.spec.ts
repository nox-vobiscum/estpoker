// tests/reconnect-state.spec.ts
// Refresh after reset shows pre-vote UI for a non-host

import { test, expect } from '@playwright/test';
import {
  roomUrlFor,
  newRoomCode,
  ensureMenuOpen,
  ensureMenuClosed,
  pickTwoNumeric,
  clickByValue,
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

  // Ensure a numeric-friendly deck so we can vote reliably
  await setSequence(host, 'fib.scrum');
  await waitSeq(host, 'fib.scrum');

  // Both vote (some builds require >=2 votes to enable reveal)
  const pair = await pickTwoNumeric(host);
  expect(pair).not.toBeNull();
  const [a, b] = pair!;
  expect(await clickByValue(host, a)).toBeTruthy();
  expect(await clickByValue(guest, b)).toBeTruthy();

  // Reveal on host using robust helper (no dependence on visible button)
  expect(await revealNow(host)).toBe(true);

  // Reset the round
  expect(await resetNow(host)).toBe(true);

  // Guest reload & verify pre-vote UI
  await guest.reload({ waitUntil: 'domcontentloaded' });
  expect(await waitPreVote(guest, 3000)).toBe(true);

  await ctxHost.close();
  await ctxGuest.close();
});
