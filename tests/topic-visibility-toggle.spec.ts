// tests/topic-visibility-toggle.spec.ts
import { test, expect } from '@playwright/test';

function newRoom(prefix='TVIS'){ return `${prefix}-${Date.now()}-${Math.floor(Math.random()*1e6)}`; }

test('Topic visibility toggles [hidden] and .is-hidden correctly', async ({ page }) => {
  const room = newRoom();

  await page.goto(`/room?roomCode=${encodeURIComponent(room)}&participantName=Host`, {
    waitUntil: 'domcontentloaded',
  });

  // Ensure JS boot completed and listeners are bound
  await expect(page.locator('html')).toHaveAttribute('data-ready', '1');
  // Single participant ⇒ we are host
  await expect(page.locator('#liveParticipantList .participant-row.is-host')).toHaveCount(1);

  const row = page.locator('#topicRow');

  // Turn ON (host event) → renderTopic() will sync [hidden] and classes
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('ep:topic-toggle', { detail: { on: true } }));
  });
  await expect(row).toBeVisible();
  await expect(row).not.toHaveAttribute('hidden', /.+/);
  await expect(row).not.toHaveClass(/is-hidden/);

  // Turn OFF again
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('ep:topic-toggle', { detail: { on: false } }));
  });
  await expect(row).toBeHidden();
  await expect(row).toHaveAttribute('hidden', '');
  await expect(row).toHaveClass(/is-hidden/);
});
