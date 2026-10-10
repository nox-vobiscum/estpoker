import { test, expect } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';
import { ensureMenuOpen, ensureMenuClosed } from './utils/helpers';

test('hard mode gates reveal and host transfer updates permissions', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const room = newRoomCode('REBRAND');
    await host.goto(roomUrlFor('Host', room));
    await expect(host.locator('#liveParticipantList .host-label')).toHaveCount(1);
    await guest.goto(roomUrlFor('Guest', room));
    await expect(host.locator('#liveParticipantList .participant-row')).toHaveCount(2);

    await ensureMenuOpen(host);
    await host.locator('#menuHardModeToggle').check();
    await ensureMenuClosed(host);
    await host.locator('#cardGrid button').filter({ hasText: /^5$/ }).click();
    await expect(host.locator('#revealButton')).toBeDisabled();
    await guest.locator('#cardGrid button').filter({ hasText: /^3$/ }).click();
    await expect(host.locator('#revealButton')).toBeEnabled();
    await host.locator('#revealButton').click();
    await expect(guest.locator('#averageVote')).toHaveText('4');
    await host.locator('#resetButton').click();
    await expect(host.locator('#revealButton')).toBeVisible();

    host.on('dialog', dialog => dialog.accept());
    await host.locator('[data-action="host"][data-name="Guest"]').click();
    const guestRow = guest.locator('#liveParticipantList .participant-row').filter({ hasText: 'Guest' });
    await expect(guestRow.locator('.host-label')).toHaveCount(1);
    await ensureMenuOpen(guest);
    await expect(guest.locator('#menuHardModeToggle')).toBeEnabled();
    // Hard mode is intentionally local to each client in the existing implementation.
    await expect(guest.locator('#menuHardModeToggle')).not.toBeChecked();
    await guest.locator('#menuHardModeToggle').check();
    await ensureMenuClosed(guest);
    await ensureMenuOpen(host);
    await expect(host.locator('#menuHardModeToggle')).toBeDisabled();
    await expect(host.locator('#menuHardModeToggle')).toBeChecked();
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
