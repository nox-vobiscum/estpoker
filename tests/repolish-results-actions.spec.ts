import { expect, test, type Page } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

async function joinPair(browser: any, width: number) {
  const hostContext = await browser.newContext({ viewport: { width, height: width <= 600 ? 667 : 900 } });
  const guestContext = await browser.newContext({ viewport: { width, height: width <= 600 ? 667 : 900 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const room = newRoomCode('RP005');
  await host.goto(roomUrlFor('Host', room));
  await expect(host.locator('#liveParticipantList .participant-row.is-host')).toHaveCount(1);
  await guest.goto(roomUrlFor('Guest', room));
  await expect(host.locator('#liveParticipantList .participant-row')).toHaveCount(2);
  return { host, guest, close: async () => { await hostContext.close(); await guestContext.close(); } };
}

async function voteAndReveal(host: Page, guest: Page, hostVote: string, guestVote: string) {
  await host.locator(`#cardGrid button[data-value="${hostVote}"]`).click();
  await guest.locator(`#cardGrid button[data-value="${guestVote}"]`).click();
  await host.locator('#revealButton').click();
  await expect(host.locator('#resultRow')).not.toHaveClass(/is-hidden/);
}

test('result states, compact host action and preserved guide/leave controls', async ({ browser }) => {
  const p = await joinPair(browser, 1280);
  try {
    const { host, guest } = p;
    await expect(host.locator('#resultRow')).toHaveClass(/is-hidden/);
    await expect(host.locator('#revealButton')).toBeVisible();
    await expect(guest.locator('#revealButton:visible, #resetButton:visible')).toHaveCount(0);
    await expect(host.locator('#roomManual')).not.toHaveAttribute('open');
    await expect(host.locator('#leaveRoomBtn')).toBeVisible();

    await voteAndReveal(host, guest, '3', '3');
    await expect(host.locator('#resultRow')).toHaveClass(/(^|\s)consensus(\s|$)/);
    await expect(host.locator('#resultLabel .label-consensus')).toBeVisible();
    await expect(host.locator('#medianWrap:visible, #rangeWrap:visible')).toHaveCount(0);
    await expect(host.locator('#resetButton')).toBeVisible();

    const layout = await host.evaluate(() => {
      const action = document.querySelector('#resetButton')!.getBoundingClientRect();
      const guide = document.querySelector('.room-manual')!.getBoundingClientRect();
      return { actionWidth: action.width, gap: guide.top - action.bottom };
    });
    expect(layout.actionWidth).toBeLessThan(240);
    expect(layout.gap).toBeGreaterThanOrEqual(32);
    expect(layout.gap).toBeLessThanOrEqual(80);

    await host.locator('#resetButton').click();
    await expect(host.locator('#resultRow')).toHaveClass(/is-hidden/);
    await expect(host.locator('#revealButton')).toBeVisible();
    await voteAndReveal(host, guest, '3', '8');
    await expect(host.locator('#resultRow')).not.toHaveClass(/(^|\s)consensus(\s|$)/);
    await expect(host.locator('#medianWrap')).toBeVisible();
    await expect(host.locator('#rangeWrap')).toBeVisible();
    await expect(host.locator('#resultLabel .label-consensus')).toBeHidden();
  } finally { await p.close(); }
});

test('mobile sticky host action clears cards, guide, leave control and footer', async ({ browser }) => {
  const p = await joinPair(browser, 375);
  try {
    const { host, guest } = p;
    await expect(guest.locator('#revealButton:visible, #resetButton:visible')).toHaveCount(0);
    const action = host.locator('#revealButton');
    const lastCard = host.locator('#cardGrid button').last();
    await expect(action).toBeVisible();
    await lastCard.scrollIntoViewIfNeeded();
    const clearsStickyAction = await host.evaluate(() => {
      const card = document.querySelector('#cardGrid button:last-of-type')!;
      const action = document.querySelector('#revealButton')!;
      const overlap = card.getBoundingClientRect().bottom - action.getBoundingClientRect().top;
      if (overlap > 0) scrollBy(0, overlap + 16);
      return new Promise<boolean>(resolve => requestAnimationFrame(() => resolve(
        card.getBoundingClientRect().bottom <= action.getBoundingClientRect().top
      )));
    });
    expect(clearsStickyAction).toBe(true);

    await host.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const bottom = await host.evaluate(() => {
      const action = document.querySelector('#revealButton')!.getBoundingClientRect();
      const guide = document.querySelector('.room-manual')!.getBoundingClientRect();
      const leave = document.querySelector('.room-exit-row')!.getBoundingClientRect();
      const footer = document.querySelector('.app-footer')!.getBoundingClientRect();
      return { actionTop: action.top, actionBottom: action.bottom, guideBottom: guide.bottom,
        leaveBottom: leave.bottom, footerTop: footer.top, overflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(bottom.actionBottom).toBeLessThanOrEqual(bottom.footerTop);
    expect(bottom.guideBottom).toBeLessThanOrEqual(bottom.actionTop);
    expect(bottom.leaveBottom).toBeLessThanOrEqual(bottom.actionTop);
    expect(bottom.overflow).toBeLessThanOrEqual(1);
  } finally { await p.close(); }
});
