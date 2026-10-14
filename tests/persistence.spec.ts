import { test, expect } from '@playwright/test';
import { roomUrlFor, newRoomCode, ensureMenuOpen, ensureMenuClosed } from './utils/helpers';

test('Auto-Reveal state persists in room across reload (guest sees it checked/effective)', async ({ browser }) => {
  const room = newRoomCode('AR-PERSIST');
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    await host.goto(roomUrlFor('Host', room));
    await expect(host.locator('#liveParticipantList .host-label')).toHaveCount(1);
    await guest.goto(roomUrlFor('Guest', room));
    await expect(host.locator('#liveParticipantList .participant-row')).toHaveCount(2);

    await ensureMenuOpen(host);
    await host.locator('#menuAutoRevealToggle').check();
    await expect(host.locator('#menuAutoRevealToggle')).toBeChecked();
    await ensureMenuClosed(host);

    // Wait for the server's setting to reach the guest before reloading.
    await ensureMenuOpen(guest);
    await expect(guest.locator('#menuAutoRevealToggle')).toBeChecked();
    await expect(guest.locator('#menuAutoRevealToggle')).toBeDisabled();
    await ensureMenuClosed(guest);
    await guest.reload();
    await expect(guest.locator('#cardGrid button').first()).toBeVisible();
    await ensureMenuOpen(guest);
    await expect(guest.locator('#menuAutoRevealToggle')).toBeChecked();
    await expect(guest.locator('#menuAutoRevealToggle')).toBeDisabled();
    await ensureMenuClosed(guest);

    // The restored setting must still cause an automatic reveal.
    await host.locator('#cardGrid button[data-value="3"]').click();
    await guest.locator('#cardGrid button[data-value="5"]').click();
    await expect(host.locator('#resetButton')).toBeVisible();
    await expect(guest.locator('#resetButton')).toBeHidden();
    for (const client of [host, guest]) {
      await expect(client.locator('#averageVote')).toBeVisible();
      await expect(client.locator('#averageVote')).toHaveText('4');
    }
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
