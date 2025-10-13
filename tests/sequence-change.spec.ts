// tests/sequence-change.spec.ts
import { test, expect } from '@playwright/test';
import {
  openTwoClients,
  waitAppReady,
  waitHostRole,
  setSequenceRobust,
  deckHasInfinity,
  lastSeqFromBus,
} from './utils/helpers';

test.describe('Host-only sequence change resets round and syncs to guest', () => {
  test('business effect: deck, reset, propagation, server echo', async ({ browser }) => {
    const { host, guest, closeAll } = await openTwoClients(browser);
    try {
      await waitAppReady(host.page);
      await waitAppReady(guest.page);
      await waitHostRole(host.page);

      // Precondition: scrum (no infinity)
      await expect(await deckHasInfinity(host.page)).toBe(false);
      await expect(await deckHasInfinity(guest.page)).toBe(false);

      // Host switches to fib.enh
      expect(await setSequenceRobust(host.page, 'fib.enh')).toBe(true);

      // Host sees ♾️
      await expect(async () => {
        expect(await deckHasInfinity(host.page)).toBe(true);
      }).toPass({ timeout: 6000 });

      // Guest sees ♾️
      await expect(async () => {
        expect(await deckHasInfinity(guest.page)).toBe(true);
      }).toPass({ timeout: 6000 });

      // Server echo confirms sequenceId on both sides
      await expect(async () => {
        expect(await lastSeqFromBus(host.page)).toBe('fib.enh');
      }).toPass({ timeout: 6000 });
      await expect(async () => {
        expect(await lastSeqFromBus(guest.page)).toBe('fib.enh');
      }).toPass({ timeout: 6000 });

      // Round should be reset (no revealed state on body)
      await expect(host.page.locator('body')).not.toHaveClass(/votes-revealed/);
      await expect(guest.page.locator('body')).not.toHaveClass(/votes-revealed/);
    } finally {
      await closeAll?.();
    }
  });
});
