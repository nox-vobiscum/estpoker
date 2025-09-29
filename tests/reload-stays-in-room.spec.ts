import { test, expect, Page, Browser } from '@playwright/test';

test('Reload in room keeps the user in the room (no invite redirect, no preflight)', async ({ page }) => {
  const room = `pw-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const name = 'Tester';

  // Open the room directly (server renders room.html; WS connects)
  await page.goto(`/room?roomCode=${encodeURIComponent(room)}&participantName=${encodeURIComponent(name)}`);

  // Participants list should render; your display name should be shown
  await expect(page.locator('#liveParticipantList')).toBeVisible();
  await expect(page.locator('#youName')).toHaveText(name);

  // Hard reload
  await page.reload();

  // Still in /room (no redirect to /invite)
  await expect(page).toHaveURL(/\/room(\?|$)/);

  // Participants list still visible, and the local "you" name is preserved
  await expect(page.locator('#liveParticipantList')).toBeVisible();
  await expect(page.locator('#youName')).toHaveText(name);

  // Just to be explicit: not the invite page
  await expect(page).not.toHaveURL(/\/invite(\?|$)/);
});
