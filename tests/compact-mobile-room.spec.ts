import { expect, test, type Page } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

async function roomGaps(page: Page) {
  return page.evaluate(() => {
    const participants = document.querySelector('#liveParticipantList')!.getBoundingClientRect();
    const result = document.querySelector('#resultRow')!.getBoundingClientRect();
    const cards = document.querySelector('#cardGrid')!.getBoundingClientRect();
    return {
      participantToResult: result.height ? result.top - participants.bottom : null,
      participantToCards: cards.top - participants.bottom,
      resultToCards: result.height ? cards.top - result.bottom : null,
      resultDisplay: getComputedStyle(document.querySelector('#resultRow')!).display,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}

for (const width of [320, 375, 393]) {
  test(`pre-reveal room does not reserve result space at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.goto(roomUrlFor('Mobile Host', newRoomCode('COMPACT')));
    await expect(page.locator('body')).toHaveClass(/is-host/);

    const gaps = await roomGaps(page);
    expect(gaps.resultDisplay).toBe('none');
    expect(gaps.participantToCards).toBeLessThanOrEqual(24);
    expect(gaps.overflow).toBeLessThanOrEqual(1);

    const lastCardReachable = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>('#cardGrid button:last-of-type')!;
      card.scrollIntoView({ block: 'center' });
      const rect = card.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight;
    });
    expect(lastCardReachable).toBe(true);
  });
}

test('consensus, statistics, topic and alternate deck keep compact mobile flow', async ({ browser }) => {
  test.setTimeout(45_000);
  const hostContext = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const guestContext = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const room = newRoomCode('COMPACT');
  try {
    await host.goto(roomUrlFor('Host', room));
    await guest.goto(roomUrlFor('Guest', room));
    await expect(host.locator('#liveParticipantList .participant-row')).toHaveCount(2);

    await host.evaluate(() => document.dispatchEvent(new CustomEvent('pp:topic-toggle', { detail: { on: true } })));
    await expect(host.locator('#topicRow')).toBeVisible();

    for (const votes of [['3', '3'], ['3', '8']] as const) {
      await host.locator(`#cardGrid button[data-value="${votes[0]}"]`).click();
      await guest.locator(`#cardGrid button[data-value="${votes[1]}"]`).click();
      await host.locator('#revealButton').click();
      await expect(host.locator('#resultRow')).toBeVisible();

      const gaps = await roomGaps(host);
      expect(gaps.participantToResult).toBeLessThanOrEqual(24);
      expect(gaps.resultToCards).toBeLessThanOrEqual(16);
      expect(gaps.overflow).toBeLessThanOrEqual(1);
      await host.locator('#resetButton').click();
    }

    await host.evaluate(() => document.dispatchEvent(new CustomEvent('pp:sequence-change', { detail: { id: 'tshirt' } })));
    await expect(host.locator('#cardGrid button').first()).toBeVisible();
    const lastCardReachable = await host.evaluate(() => {
      const card = document.querySelector<HTMLElement>('#cardGrid button:last-of-type')!;
      card.scrollIntoView({ block: 'center' });
      const rect = card.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight;
    });
    expect(lastCardReachable).toBe(true);
    const actionAfterCards = await host.evaluate(() => {
      const cards = document.querySelector('#cardGrid')!.getBoundingClientRect();
      const action = document.querySelector('#revealButton')!.getBoundingClientRect();
      return action.top >= cards.bottom - 1;
    });
    expect(actionAfterCards).toBe(true);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
