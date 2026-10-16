import { expect, test, type Page } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

const widths = [320, 375, 393, 430];

for (const width of widths) {
  test(`mobile room metadata wraps without collisions at ${width}px`, async ({ page }) => {
    const name = `Roland-with-a-deliberately-long-mobile-name-${width}`;
    const room = `mobile-room-code-${width}-${Date.now()}`;
    await page.setViewportSize({ width, height: 852 });
    await page.goto(roomUrlFor(name, room));
    await expect(page.locator('body')).toHaveClass(/is-host/);

    const geometry = await page.evaluate(() => {
      const participant = document.querySelector('.main-info-group--participant')!.getBoundingClientRect();
      const room = document.querySelector('.main-info-group--room')!.getBoundingClientRect();
      const name = document.querySelector('#youName')!;
      const code = document.querySelector('#roomCodeVal')!;
      const copy = document.querySelector('#copyRoomLink')!.getBoundingClientRect();
      const codeRect = code.getBoundingClientRect();
      return {
        stacked: room.top >= participant.bottom - 1,
        nameFits: name.scrollWidth <= name.clientWidth,
        codeFits: code.scrollWidth <= code.clientWidth,
        copyClear: codeRect.right <= copy.left - 7,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(geometry.stacked).toBe(true);
    expect(geometry.nameFits).toBe(true);
    expect(geometry.codeFits).toBe(true);
    expect(geometry.copyClear).toBe(true);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
  });
}

async function participantRow(page: Page, name: string) {
  const row = page.locator('#liveParticipantList .participant-row').filter({ has: page.locator('.name', { hasText: new RegExp(`^${name}$`) }) });
  await expect(row).toHaveCount(1);
  return row;
}

test('mobile participant roles, chips and round action remain reachable', async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ viewport: { width: 393, height: 852 } })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const host = pages[0]!;
  const spectator = pages[1]!;
  const inactive = pages[2]!;
  const guest = pages[3]!;
  const room = newRoomCode('IOS');
  try {
    await host.goto(roomUrlFor('Host-with-a-long-name', room));
    await expect(host.locator('body')).toHaveClass(/is-host/);
    await spectator.goto(roomUrlFor('Spectator-with-a-long-name', room));
    await inactive.goto(roomUrlFor('Inactive-with-a-long-name', room));
    await guest.goto(roomUrlFor('Guest-with-a-long-name', room));
    await expect(host.locator('#liveParticipantList .participant-row')).toHaveCount(4);

    const spectatorRow = await participantRow(host, 'Spectator-with-a-long-name');
    await spectatorRow.locator('.participant-more').click();
    await host.getByRole('menuitem', { name: 'Make spectator', exact: true }).click();
    await expect(spectatorRow).toHaveClass(/spectator/);
    await contexts[2]!.close();
    const inactiveRow = await participantRow(host, 'Inactive-with-a-long-name');
    await expect(inactiveRow).toHaveClass(/disconnected/, { timeout: 5_000 });

    const layout = await host.evaluate(() => {
      const rows = Array.from(document.querySelectorAll<HTMLElement>('#liveParticipantList .participant-row'));
      const firstChip = document.querySelector<HTMLElement>('#liveParticipantList .mini-chip');
      const cards = document.querySelector('#cardGrid')!.getBoundingClientRect();
      const action = document.querySelector<HTMLElement>('#revealButton:not([hidden]),#resetButton:not([hidden])')!.getBoundingClientRect();
      return {
        rowsClear: rows.every(row => {
          const identity = row.querySelector('.participant-identity')!.getBoundingClientRect();
          const right = row.querySelector('.row-right')!.getBoundingClientRect();
          return identity.right <= right.left + 1;
        }),
        chipWidth: firstChip?.getBoundingClientRect().width ?? 0,
        actionAfterCards: action.top >= cards.bottom - 1,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(layout.rowsClear).toBe(true);
    expect(layout.chipWidth).toBeLessThanOrEqual(49);
    expect(layout.actionAfterCards).toBe(true);
    expect(layout.overflow).toBeLessThanOrEqual(1);

    await host.locator('#menuButton').click();
    const tshirt = host.locator('#menuSeqChoice input[value="tshirt"]');
    await tshirt.check();
    await expect(tshirt).toBeChecked();
    await host.locator('#menuCloseButton').click();
    await expect(host.locator('#cardGrid button').first()).toBeVisible();
    const alternateDeck = await host.evaluate(() => {
      const cards = document.querySelector('#cardGrid')!.getBoundingClientRect();
      const action = document.querySelector<HTMLElement>('#revealButton:not([hidden]),#resetButton:not([hidden])')!.getBoundingClientRect();
      return { actionAfterCards: action.top >= cards.bottom - 1 };
    });
    expect(alternateDeck.actionAfterCards).toBe(true);

    await host.locator('.vote-actions').evaluate(element => element.scrollIntoView({ block: 'center' }));
    await expect(host.locator('#revealButton')).toBeInViewport();
    const sticky = await host.evaluate(() => {
      const action = document.querySelector('#revealButton')!.getBoundingClientRect();
      const footer = document.querySelector('.app-footer')!.getBoundingClientRect();
      return { clearOfFooter: action.bottom <= footer.top + 1, overflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(sticky.clearOfFooter).toBe(true);
    expect(sticky.overflow).toBeLessThanOrEqual(1);
  } finally {
    await Promise.all(contexts.map(context => context.close().catch(() => {})));
  }
});
