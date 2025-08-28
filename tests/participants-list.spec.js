// Ensures the participant list renders on first join (no reload required)
import { test, expect } from '@playwright/test';

// Minimal helpers (no external deps)
function roomUrlFor(name, roomCode) {
  const base = process.env.EP_ROOM_URL || 'http://localhost:8080/room';
  const p = new URLSearchParams({ participantName: name, roomCode });
  return `${base}?${p.toString()}`;
}
function newRoomCode(prefix = 'PLIST') {
  const r = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${r}`;
}

test('Initial participant list shows current user without refresh', async ({ page }) => {
  const user = 'ListUser';
  const roomCode = newRoomCode();

  await page.goto(roomUrlFor(user, roomCode), { waitUntil: 'domcontentloaded' });

  // Wait until the list has at least one row (WS state broadcast received)
  await page.waitForFunction(() =>
    document.querySelectorAll('#liveParticipantList .participant-row').length > 0
  );

  const list = page.locator('#liveParticipantList .participant-row');
  await expect(list.first()).toBeVisible();

  // The first row should contain our name
  const firstRow = list.first();
  await expect(firstRow).toContainText(user);

  // Host crown should be present for the very first participant
  const crown = firstRow.locator('.participant-icon.host');
  await expect(crown).toHaveText('👑');

  // Sanity: pre-vote UI should be visible (no reveal yet)
  await expect(page.locator('.pre-vote')).toBeVisible();
  await expect(page.locator('.post-vote')).toBeHidden();
});
