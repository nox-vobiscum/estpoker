// tests/menu-sequence.spec.ts
import { test, expect } from '@playwright/test';
import {
  openTwoClients,
  waitAppReady,
  waitHostRole,
  setSequenceRobust,
  deckHasInfinity,
  lastSeqFromBus,
} from './utils/helpers';

test.describe('Menu sequence radios: host enabled, guest disabled; change propagates', () => {
  test('business effect + propagation without radio flakiness', async ({ browser }) => {
    const { host, guest, closeAll } = await openTwoClients(browser);
    try {
      // Ensure app + host wiring is ready
      await waitAppReady(host.page);
      await waitAppReady(guest.page);
      await waitHostRole(host.page);

      // Precondition: scrum (no infinity)
      await expect(await deckHasInfinity(host.page)).toBe(false);
      await expect(await deckHasInfinity(guest.page)).toBe(false);

      // Host switches to fib.enh (event-first; falls back to radios if needed)
      expect(await setSequenceRobust(host.page, 'fib.enh')).toBe(true);

      // Host sees ♾️
      await expect(async () => {
        expect(await deckHasInfinity(host.page)).toBe(true);
      }).toPass({ timeout: 6000, intervals: [200, 300, 500] });

      // Guest sees ♾️
      await expect(async () => {
        expect(await deckHasInfinity(guest.page)).toBe(true);
      }).toPass({ timeout: 6000, intervals: [200, 300, 500] });

      // Server echo confirms sequenceId on both sides
      await expect(async () => {
        expect(await lastSeqFromBus(host.page)).toBe('fib.enh');
      }).toPass({ timeout: 6000 });
      await expect(async () => {
        expect(await lastSeqFromBus(guest.page)).toBe('fib.enh');
      }).toPass({ timeout: 6000 });
    } finally {
      await closeAll?.();
    }
  });
});
