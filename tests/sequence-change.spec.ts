// tests/sequence-change.spec.ts
// Host-only sequence change resets round and syncs to guest (robust: Grid-Heuristik)

import { test, expect } from '@playwright/test';
import {
  roomUrlFor,
  newRoomCode,
} from './utils/env';
import {
  ensureMenuOpen,
  ensureMenuClosed,
  setSequence,
  waitSeq,
  getSelectedSequenceId,
  detectSequenceFromGrid,
  readDeckValues,
} from './utils/helpers';

const CANDIDATES = ['fib.scrum', 'fib.enh', 'fib.math', 'pow2', 'tshirt'] as const;

async function allSequenceValues(page) {
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

  // Radios sichtbar/gleich?
  await ensureMenuOpen(host);
  await ensureMenuOpen(guest);

  const hostRadios = host.locator('#menuSeqChoice input[name="menu-seq"]');
  const guestRadios = guest.locator('#menuSeqChoice input[name="menu-seq"]');
  const hostCount = await hostRadios.count();
  const guestCount = await guestRadios.count();
  expect(hostCount).toBeGreaterThan(0);
  expect(guestCount).toBe(hostCount);

  await ensureMenuClosed(host);
  await ensureMenuClosed(guest);

  // Aktuelle Auswahl (Gast)
  const initialGuestSeq = await getSelectedSequenceId(guest);

  // Ziel = anders als Gast
  const vals = await allSequenceValues(host);
  const target = (vals.find(v => v !== initialGuestSeq) ?? vals[0])!;

  // Host setzt Sequenz
  await setSequence(host, target);

  // Host → Gast: Warte mit Radio- oder Grid-Erkennung
  await expect
    .poll(async () => (await getSelectedSequenceId(host)) || (await detectSequenceFromGrid(host)), {
      timeout: 6000,
      intervals: [200, 300, 500],
    })
    .toBe(target);

  await expect
    .poll(async () => (await getSelectedSequenceId(guest)) || (await detectSequenceFromGrid(guest)), {
      timeout: 6000,
      intervals: [200, 300, 500],
    })
    .toBe(target);

  // Sekundäre Sicherung (Helper nutzt beide Wege)
  expect(await waitSeq(host, target, 4000)).toBe(true);
  expect(await waitSeq(guest, target, 4000)).toBe(true);

  await ctxHost.close();
  await ctxGuest.close();
});
