// tests/sequence-change.spec.ts
// Host-only sequence change resets round and syncs to guest (no assumption about initial default)

import { test, expect } from '@playwright/test';
import {
  roomUrlFor,
  newRoomCode,
  ensureMenuOpen,
  ensureMenuClosed,
  setSequence,
  waitSeq,
  getSelectedSequenceId,
} from './utils/helpers';

async function allSequenceValues(page) {
  await ensureMenuOpen(page);
  const vals = await page
    .$$eval(
      '#menuSeqChoice input[name="menu-seq"], [data-test="seq-choice"] input[name="menu-seq"]',
      (els) => els.map((el) => (el as HTMLInputElement).value).filter(Boolean)
    )
    .catch(() => [] as string[]);
  await ensureMenuClosed(page);
  return vals;
}

test('Host-only sequence change resets round and syncs to guest', async ({ browser }) => {
  const room = newRoomCode('SEQSYNC');

  const ctxHost = await browser.newContext();
  const ctxGuest = await browser.newContext();
  const host = await ctxHost.newPage();
  const guest = await ctxGuest.newPage();

  await host.goto(roomUrlFor('Host', room), { waitUntil: 'domcontentloaded' });
  await guest.goto(roomUrlFor('Guest', room), { waitUntil: 'domcontentloaded' });

  // Snapshot current selected (no default assumption)
  const initialGuestSeq = await getSelectedSequenceId(guest);

  // Pick a different value present in host menu
  const vals = await allSequenceValues(host);
  expect(vals.length).toBeGreaterThan(0);
  const target = vals.find((v: string) => v && v !== initialGuestSeq) ?? vals[0]!;
  await setSequence(host, target);

  // Host sees it, then guest syncs
  expect(await waitSeq(host, target, 4000)).toBe(true);
  expect(await waitSeq(guest, target, 4000)).toBe(true);

  await ctxHost.close();
  await ctxGuest.close();
});
