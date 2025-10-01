// tests/prod-smoke.spec.ts
// Prod smoke: only runs when EP_BASE_URL and EP_ROOM_URL are provided.
// Locally (no env) this test is auto-skipped.

import { test, expect } from '@playwright/test';
import type { ConsoleMessage } from '@playwright/test';

const EP_BASE_URL = process.env.EP_BASE_URL || '';
const EP_ROOM_URL = process.env.EP_ROOM_URL || '';

// Auto-skip when not configured
test.skip(
  !EP_BASE_URL || !EP_ROOM_URL,
  'EP_BASE_URL / EP_ROOM_URL not set → skipping prod smoke test'
);

test('Prod smoke: page loads and menu open/close', async ({ page }) => {
  // Collect console errors from the very beginning
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(EP_ROOM_URL, { waitUntil: 'domcontentloaded' });

  // Minimal UI probe — keep selector forgiving
  await expect(page.locator('#cardGrid')).toBeVisible();

  // Try to open/close menu if a toggle is present (best-effort)
  const menuToggle = page.locator(
    '#menuToggle, [data-test="menu-toggle"], button[aria-label="Menu"]'
  );
  if (await menuToggle.count()) {
    await menuToggle.first().click().catch(() => {});
    await page.waitForTimeout(200);
    await menuToggle.first().click().catch(() => {});
  }

  // Ensure no console errors (ignore warnings/info)
  await page.waitForTimeout(200);
  expect(errors.length, `console errors:\n${errors.join('\n')}`).toBe(0);
});
