import { expect, test } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

async function expectParticipantCount(page: any, expected: number) {
  await expect(page.locator('#liveParticipantList .participant-row')).toHaveCount(expected);
  await expect(page.locator('#participantCount')).toHaveText(String(expected));
}

test('participant heading follows the displayed roster through role and presence changes', async ({ browser }) => {
  const room = newRoomCode('COUNT');
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    await host.goto(roomUrlFor('CountHost', room));
    await expectParticipantCount(host, 1);

    await guest.goto(roomUrlFor('CountGuest', room));
    await expectParticipantCount(host, 2);

    const guestRow = host.locator('#liveParticipantList .participant-row').filter({ hasText: 'CountGuest' });
    await guestRow.locator('.participant-more').click();
    await guestRow.locator('button.row-action.spectator').click();
    await expect(guestRow).toHaveClass(/spectator/);
    await expectParticipantCount(host, 2);

    await guestContext.close();
    await expect(guestRow).toHaveClass(/disconnected/, { timeout: 8_000 });
    await expectParticipantCount(host, 2);

    host.once('dialog', dialog => dialog.accept());
    await guestRow.locator('.participant-more').click();
    await guestRow.locator('button.row-action.kick').click();
    await expectParticipantCount(host, 1);
  } finally {
    await hostContext.close();
    await guestContext.close().catch(() => {});
  }
});

for (const { width, language, label } of [
  { width: 375, language: 'de', label: 'Teilnehmende' },
  { width: 1280, language: 'en', label: 'Participants' },
]) {
  test(`participant heading is compact and translated at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${roomUrlFor('HeadingHost', newRoomCode('COUNT'))}&lang=${language}`);

    const heading = page.locator('h2.participant-heading');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveAccessibleName(label);
    await expect(page.locator('#participantCount')).toHaveText('1');

    const geometry = await heading.evaluate(element => {
      const headingRect = element.getBoundingClientRect();
      const countRect = element.querySelector('#participantCount')!.getBoundingClientRect();
      return {
        aligned: Math.abs((headingRect.top + headingRect.height / 2) - (countRect.top + countRect.height / 2)),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headingFontSize: getComputedStyle(element).fontSize,
        topicHeadingFontSize: getComputedStyle(document.querySelector('.topic-heading')!).fontSize,
      };
    });
    expect(geometry.aligned).toBeLessThanOrEqual(1);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.headingFontSize).toBe(geometry.topicHeadingFontSize);
  });
}
