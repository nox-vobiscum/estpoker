// tests/sequence-change.spec.ts
// Host-only sequence change resets round and syncs to guest (no assumption about initial default)

import { test, expect, type Page } from '@playwright/test';
import {
  roomUrlFor,
  newRoomCode,
  ensureMenuOpen,
  ensureMenuClosed,
  setSequence,
  waitSeq,
  getSelectedSequenceId,
} from './utils/helpers';

async function allSequenceValues(page: Page) {
  await ensureMenuOpen(page);
  const vals = await page
    .$$eval('#menuSeqChoice input[name="menu-seq"]', els =>
      els.map(el => (el as HTMLInputElement).value).filter(Boolean)
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

  // Both see radios; guest radios are disabled
  await ensureMenuOpen(host);
  await ensureMenuOpen(guest);

  const hostRadios = host.locator('#menuSeqChoice input[name="menu-seq"]');
  const guestRadios = guest.locator('#menuSeqChoice input[name="menu-seq"]');

  const hostCount = await hostRadios.count();
  const guestCount = await guestRadios.count();
  expect(hostCount).toBeGreaterThan(0);
  expect(guestCount).toBe(hostCount);

  const guestDisabledFlags = await guestRadios.evaluateAll(list =>
    list.map((el: any) => (el as HTMLInputElement).disabled)
  );
  expect(guestDisabledFlags.every(Boolean)).toBeTruthy();

  await ensureMenuClosed(host);
  await ensureMenuClosed(guest);

  // Snapshot current selected (no assumption what the default is)
  const initialGuestSeq = await getSelectedSequenceId(guest);

  // Host picks a different sequence than what the guest currently has
  const vals = await allSequenceValues(host);
  expect(vals.length).toBeGreaterThan(0); // <-- guard against empty list

  const target = (vals.find(v => v !== initialGuestSeq) ?? vals[0])!; // <-- non-null after guard
  await setSequence(host, target);

  // Wait until the guest reflects the host's new choice
  await expect
    .poll(async () => {
      await ensureMenuOpen(guest);
      const v = await getSelectedSequenceId(guest);
      await ensureMenuClosed(guest);
      return v;
    }, { timeout: 6000, intervals: [250] }) // <-- intervals (plural)
    .toBe(target);

  // (Optional) ensure host reflects its own change too
  await waitSeq(host, target);

  await ctxHost.close();
  await ctxGuest.close();
});
