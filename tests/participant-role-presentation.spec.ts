import { expect, test } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

test('participant roles stay beside the name while the vote slot remains centered', async ({ browser }) => {
  const room = newRoomCode('ROLES');
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  try {
    await host.goto(roomUrlFor('RoleHost', room));
    await expect(host.locator('#liveParticipantList .participant-row.is-host')).toHaveCount(1);
    await guest.goto(roomUrlFor('RoleGuest', room));

    const rows = host.locator('#liveParticipantList .participant-row');
    await expect(rows).toHaveCount(2);
    const hostRow = rows.filter({ has: host.locator('.name', { hasText: /^RoleHost$/ }) });
    const guestRow = rows.filter({ has: host.locator('.name', { hasText: /^RoleGuest$/ }) });

    await expect(hostRow.locator('.participant-identity .participant-role-host')).toHaveCount(1);
    await expect(hostRow.locator('.host-label')).toHaveText('Host');
    await expect(guestRow.locator('.participant-role-host')).toHaveCount(0);

    await guestRow.locator('.participant-more').click();
    await guestRow.locator('button.row-action.spectator').click();
    await expect(guestRow).toHaveClass(/spectator/);
    await expect(guestRow.locator('.participant-identity .participant-role-spectator')).toHaveCount(1);
    await expect(guestRow.locator('.spectator-label')).toHaveText('Spectator');
    await expect(guestRow.locator('.row-right .spectator-slot')).toHaveText('–');

    const centers = await guestRow.evaluate(row => {
      const rowRect = row.getBoundingClientRect();
      const slotRect = row.querySelector('.row-right .spectator-slot')!.getBoundingClientRect();
      return {
        delta: Math.abs((rowRect.left + rowRect.width / 2) - (slotRect.left + slotRect.width / 2)),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(centers.delta).toBeLessThanOrEqual(1);
    expect(centers.overflow).toBeLessThanOrEqual(1);

    await guestContext.close();
    await expect(guestRow).toHaveClass(/disconnected/, { timeout: 5_000 });
    await expect(guestRow.locator('.participant-identity .participant-role-inactive')).toHaveCount(1);
    await expect(guestRow.locator('.inactive-label')).toHaveText('Inactive');
  } finally {
    await hostContext.close();
    await guestContext.close().catch(() => {});
  }
});

for (const width of [320, 1280]) {
  test(`long participant identity remains contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(roomUrlFor(`Participant-${'x'.repeat(80)}`, newRoomCode('LONGNAME')));

    const row = page.locator('#liveParticipantList .participant-row');
    await expect(row).toHaveCount(1);
    const geometry = await row.evaluate(element => {
      const rowRect = element.getBoundingClientRect();
      const nameRect = element.querySelector('.name')!.getBoundingClientRect();
      const chipRect = element.querySelector('.row-right .mini-chip')!.getBoundingClientRect();
      return {
        nameContained: nameRect.right <= rowRect.right + 1,
        chipDelta: Math.abs((rowRect.left + rowRect.width / 2) - (chipRect.left + chipRect.width / 2)),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(geometry.nameContained).toBe(true);
    expect(geometry.chipDelta).toBeLessThanOrEqual(1);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
  });
}
