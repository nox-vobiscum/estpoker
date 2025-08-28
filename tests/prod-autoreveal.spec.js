// Prod: Auto-Reveal happy path
// - Host enables Auto-Reveal
// - 3 users vote (Host + 2 guests)
// - Reveal happens automatically (no host click)

import { test, expect } from '@playwright/test';
import { roomUrlFor, newRoomCode, ensureMenuOpen, ensureMenuClosed } from './_setup/prod-helpers.js';

test.beforeAll(() => {
  expect(process.env.EP_BASE_URL, 'EP_BASE_URL must be set (https://...)').toMatch(/^https?:\/\//);
  expect(process.env.EP_ROOM_URL, 'EP_ROOM_URL must be set (https://...\/room)/').toMatch(/^https?:\/\//);
});

// Click a card by exact visible label (e.g., '3' must not match '13')
async function clickCardExact(page, label) {
  const byRole = page.getByRole('button', { name: label, exact: true });
  if (await byRole.count()) { await byRole.first().click(); return; }
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page.locator('button', { hasText: new RegExp(`^\\s*${esc}\\s*$`) }).first().click();
}

test('Prod: Auto-Reveal toggled → 3 votes → reveal auto', async ({ browser }) => {
  const room = newRoomCode('PROD-AR');

  // Open three clients in the same room
  const hostCtx = await browser.newContext();
  const aCtx    = await browser.newContext();
  const bCtx    = await browser.newContext();

  const host = await hostCtx.newPage();
  const a    = await aCtx.newPage();
  const b    = await bCtx.newPage();

  await host.goto(roomUrlFor('Host', room),  { waitUntil: 'domcontentloaded' });
  await a.goto(roomUrlFor('Alice', room),    { waitUntil: 'domcontentloaded' });
  await b.goto(roomUrlFor('Bob', room),      { waitUntil: 'domcontentloaded' });

  // Basic readiness (prod can be slower → longer timeouts)
  await expect(host.locator('#cardGrid')).toBeVisible({ timeout: 10000 });
  await expect(a.locator('#cardGrid')).toBeVisible({ timeout: 10000 });
  await expect(b.locator('#cardGrid')).toBeVisible({ timeout: 10000 });

  // Host enables Auto-Reveal
  await ensureMenuOpen(host);
  const arToggle = host.locator('#menuAutoRevealToggle');
  await expect(arToggle).toHaveCount(1);
  const wasChecked = await arToggle.isChecked().catch(() => false);
  if (!wasChecked) await arToggle.click({ force: true });
  await host.waitForTimeout(250); // small settle for WS roundtrip
  await ensureMenuClosed(host);

  // All three vote (Host participates by default)
  await clickCardExact(a, '3');
  await clickCardExact(b, '5');
  await clickCardExact(host, '8');

  // Expect automatic reveal on HOST: reset button + average visible and not "-"
  const resetBtnHost = host.locator('#resetButton');
  await expect(resetBtnHost).toBeVisible({ timeout: 10000 });

  const avgHost = host.locator('#averageVote');
  await expect(avgHost).toBeVisible({ timeout: 10000 });
  await expect(avgHost).not.toHaveText(/^-\s*$/, { timeout: 10000 });

  // Guests: do NOT require reset button (may be host-only in prod).
  // Just ensure average becomes visible and not "-"
  const avgA = a.locator('#averageVote');
  const avgB = b.locator('#averageVote');
  await expect(avgA).toBeVisible({ timeout: 10000 });
  await expect(avgB).toBeVisible({ timeout: 10000 });
  await expect(avgA).not.toHaveText(/^-\s*$/, { timeout: 10000 });
  await expect(avgB).not.toHaveText(/^-\s*$/, { timeout: 10000 });
});
