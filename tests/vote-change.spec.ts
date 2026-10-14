import { test, expect } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

for (const style of ['dev', 'clean']) {
  test(`changing votes settles without a focus resync loop (${style})`, async ({ page }) => {
    await page.addInitScript(style => localStorage.setItem('pp-ui-style', style), style);
    const sent: string[] = [];
    page.on('websocket', socket => socket.on('framesent', frame => sent.push(String(frame.payload))));
    await page.goto(roomUrlFor('Voter', newRoomCode('CHANGE')));
    const card = (value: string) => page.locator(`#cardGrid button[data-value="${value}"]`);
    await expect(page.locator('body')).toHaveClass(/is-host/);
    // Let the initial connection's delayed sync finish before measuring interactions.
    await page.waitForTimeout(400);
    sent.length = 0;
    for (const value of ['3', '5', '8', '2']) {
      await card(value).click();
      await expect(card(value)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#cardGrid .selected')).toHaveText(value);
    }
    await card('5').focus();
    await page.keyboard.press('Space');
    await expect(card('5')).toHaveAttribute('aria-pressed', 'true');
    await expect(card('5')).toBeFocused();
    await page.waitForTimeout(500);
    expect(sent.filter(line => line === 'requestSync')).toHaveLength(0);
    expect(sent.filter(line => line.startsWith('vote:'))).toEqual([
      'vote:Voter:3', 'vote:Voter:5', 'vote:Voter:8', 'vote:Voter:2', 'vote:Voter:5',
    ]);

    // Actual window activation must retain its existing reconnect/sync behavior.
    await page.evaluate(() => window.dispatchEvent(new FocusEvent('focus')));
    await expect.poll(() => sent.filter(line => line === 'requestSync').length).toBe(2);
    await page.waitForTimeout(500);
    expect(sent.filter(line => line === 'requestSync')).toHaveLength(2);
    await page.locator('#revealButton').click();
    await expect(page.locator('#averageVote')).toHaveText('5');
    await page.locator('#resetButton').click();
    await expect(page.locator('#cardGrid .selected')).toHaveCount(0);
  });
}
