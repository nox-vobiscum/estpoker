// tests/topic-overflow-hint.spec.ts
import { test, expect } from '@playwright/test';

function newRoomCode(prefix = 'TOPIC') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

test('Topic shows "more" hint when overflowing', async ({ page }) => {
  const room = newRoomCode();
  const user = 'Hosty';

  // Force a narrow view so overflow is likely
  await page.setViewportSize({ width: 380, height: 800 });

  await page.goto(
    `/room?roomCode=${encodeURIComponent(room)}&participantName=${encodeURIComponent(user)}`,
    { waitUntil: 'domcontentloaded' }
  );

  // Ensure we are host (single participant)
  await expect(page.locator('#liveParticipantList .participant-row.is-host')).toHaveCount(1);

  // Turn topic ON (host event). renderTopic() will run immediately.
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('ep:topic-toggle', { detail: { on: true } }));
  });

  const topicRow = page.locator('#topicRow');
  await expect(topicRow).toBeVisible();

  // Enter edit mode
  await page.locator('#topicEditBtn').click();

  const longTopic =
    'Implement extremely long topic to test overflow handling Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed eiusmod tempor incidunt ut labore et dolore magna aliqua.' +
    'https://example.com/some/really/long/path/that/should/overflow/in/narrow/viewports?id=1234567890&foo=bar&baz=qux';

  await page.fill('#topicDisplay', longTopic);
  await page.locator('#topicSaveBtn').click();

  // The "more" hint should show because the text overflows
  const moreHint = page.locator('#topicOverflowHint');
  await expect(moreHint).toBeVisible();
});
