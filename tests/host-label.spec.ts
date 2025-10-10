// tests/host-label.spec.ts
import { test, expect } from '@playwright/test';

function newRoomCode(prefix = 'HOST') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

test('First participant is Host and shows a single host label', async ({ page }) => {
  const room = newRoomCode('HOST');
  const user = 'Ava';

  await page.goto(`/room?roomCode=${encodeURIComponent(room)}&participantName=${encodeURIComponent(user)}`, {
    waitUntil: 'domcontentloaded',
  });

  const list = page.locator('#liveParticipantList');
  await expect(list).toBeVisible();

  const rows = list.locator('.participant-row');
  await expect(rows).toHaveCount(1);

  // Host-Label vorhanden in der ersten (und einzigen) Zeile
  const firstRowHost = rows.first().locator('.host-label');
  await expect(firstRowHost).toHaveCount(1);

  // Es gibt insgesamt genau EIN Host-Label in der Liste
  const anyHostLabels = list.locator('.host-label');
  await expect(anyHostLabels).toHaveCount(1);

  // Optional: Tooltip/ARIA vorhanden (wenn ihr das so macht)
  // Hinweis: Falls ihr aria-label statt title nutzt, die nächste Zeile anpassen.
  const hostTitle = await firstRowHost.getAttribute('title');
  if (hostTitle !== null) {
    expect(hostTitle.toLowerCase()).toContain('host');
  }
});
