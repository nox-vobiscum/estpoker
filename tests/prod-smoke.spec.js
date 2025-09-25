// tests/prod-smoke.spec.js
// Prod smoke: only runs when EP_BASE_URL and EP_ROOM_URL are provided.
// Locally (no env) this test is auto-skipped.

import { test, expect } from '@playwright/test';

const EP_BASE_URL = process.env.EP_BASE_URL || '';
const EP_ROOM_URL = process.env.EP_ROOM_URL || '';

// Auto-skip when not configured
test.skip(!EP_BASE_URL || !EP_ROOM_URL, 'EP_BASE_URL / EP_ROOM_URL not set → skipping prod smoke test');

test('Prod smoke: page loads and menu open/close', async ({ page }) => {
  // Very lightweight sanity: prod page responds and basic UI toggles work
  await page.goto(EP_ROOM_URL, { waitUntil: 'domcontentloaded' });

  // Minimal UI probes — keep selectors very forgiving
  await expect(page.locator('#cardGrid')).toBeVisible();

  // Try to open/close menu if a toggle is present (don’t fail if not)
  const menuToggle = page.locator('#menuToggle, [data-test="menu-toggle"], button[aria-label="Menu"]');
  if (await menuToggle.count()) {
    await menuToggle.first().click({ trial: false }).catch(() => {});
    await page.waitForTimeout(200);
    await menuToggle.first().click({ trial: false }).catch(() => {});
  }

  // Ensure no console errors (best-effort, ignores benign warnings)
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.waitForTimeout(200);
  expect(errors.length, `console errors: ${errors.join('\n')}`).toBe(0);
});
