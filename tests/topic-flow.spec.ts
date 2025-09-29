// Topic flow E2E (stable):
// - Show/Hide via menu toggle propagates to all clients
// - Edit & Save updates label for all clients
// - Clear resets label to "–" on all clients
// Run:
//   EP_BASE_URL=http://localhost:8080 npx playwright test -c playwright.config.ts tests/topic-flow.spec.ts

import { test, expect, Page, Browser } from '@playwright/test';
import { waitTopicVisibility } from './utils/topic';

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() { return `TPC-${Date.now().toString(36).slice(-6)}`; }
function roomUrlFor(name: string, roomCode: string) {
  const full = process.env.EP_ROOM_URL;
  if (full) {
    const u = new URL(full);
    u.searchParams.set('participantName', name);
    u.searchParams.set('roomCode', roomCode);
    return u.toString();
  }
  const u = new URL(`${baseUrl().replace(/\/$/,'')}/room`);
  u.searchParams.set('participantName', name);
  u.searchParams.set('roomCode', roomCode);
  return u.toString();
}

async function ensureMenuOpen(page: Page) {
  const overlay = page.locator('#appMenuOverlay');
  if (!(await overlay.isVisible().catch(() => false))) {
    await page.locator('#menuButton').click();
    await expect(overlay).toBeVisible();
  }
}
async function ensureMenuClosed(page: Page) {
  const overlay = page.locator('#appMenuOverlay');
  if (await overlay.isVisible().catch(() => false)) {
    await page.locator('#menuButton').click();
    await expect(overlay).toBeHidden();
  }
}
async function ensureToggleState(page: Page, selector: string, desiredChecked: boolean) {
  const el = page.locator(selector);
  await expect(el).toHaveCount(1);
  const now = await el.isChecked();
  if (now !== desiredChecked) {
    await el.click({ force: true });
  }
  // tiny debounce for WS roundtrip
  await page.waitForTimeout(120);
}

test.describe('Topic flow', () => {
  test('Show/Hide via menu toggle propagates to host & guest', async ({ browser }) => {
    const roomCode = newRoomCode();

    const ctxHost  = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host  = await ctxHost.newPage();
    const guest = await ctxGuest.newPage();

    await host.goto(roomUrlFor('Host', roomCode),  { waitUntil: 'domcontentloaded' });
    await guest.goto(roomUrlFor('Guest', roomCode), { waitUntil: 'domcontentloaded' });

    await expect(host.locator('#topicRow')).toHaveCount(1);
    await expect(guest.locator('#topicRow')).toHaveCount(1);

    // ON → both visible
    await ensureMenuOpen(host);
    await ensureToggleState(host, '#menuTopicToggle', true);
    await ensureMenuClosed(host);

    await waitTopicVisibility(host, true, 10_000);
    await waitTopicVisibility(guest, true, 10_000);

    // OFF → both hidden
    await ensureMenuOpen(host);
    await ensureToggleState(host, '#menuTopicToggle', false);
    await ensureMenuClosed(host);

    await waitTopicVisibility(host, false, 10_000);
    await waitTopicVisibility(guest, false, 10_000);

    // ON again → both visible
    await ensureMenuOpen(host);
    await ensureToggleState(host, '#menuTopicToggle', true);
    await ensureMenuClosed(host);

    await waitTopicVisibility(host, true, 10_000);
    await waitTopicVisibility(guest, true, 10_000);

    await ctxHost.close();
    await ctxGuest.close();
  });

  test('Edit & Clear topic label propagates to host & guest', async ({ browser }) => {
    const roomCode = newRoomCode();

    const ctxHost  = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host  = await ctxHost.newPage();
    const guest = await ctxGuest.newPage();

    await host.goto(roomUrlFor('Host', roomCode),  { waitUntil: 'domcontentloaded' });
    await guest.goto(roomUrlFor('Guest', roomCode), { waitUntil: 'domcontentloaded' });

    // Ensure topic row is visible before editing
    await ensureMenuOpen(host);
    await ensureToggleState(host, '#menuTopicToggle', true);
    await ensureMenuClosed(host);
    await waitTopicVisibility(host, true, 10_000);
    await waitTopicVisibility(guest, true, 10_000);

    // Locators (note: #topicDisplay is <span> in view-mode and <input> in edit-mode)
    const editBtn   = host.locator('#topicEditBtn');
    const saveBtn   = host.locator('#topicSaveBtn');
    const cancelBtn = host.locator('#topicCancelEditBtn');
    const clearBtn  = host.locator('#topicClearBtn');
    const dispHost  = host.locator('#topicDisplay');
    const dispGuest = guest.locator('#topicDisplay');

    await expect(editBtn).toBeVisible();
    await expect(clearBtn).toBeVisible();

    // Enter edit mode
    await editBtn.click();

    // In edit mode: input present and save/cancel visible
    const input = host.locator('#topicDisplay'); // becomes <input> in edit mode
    await expect(input).toBeVisible();
    await expect(host.locator('#topicSaveBtn')).toBeVisible();
    await expect(host.locator('#topicCancelEditBtn')).toBeVisible();

    // Fill & save
    const label = `Story ${Date.now().toString(36).slice(-4)}`;
    await input.fill(label);
    await host.locator('#topicSaveBtn').click();

    // Back to view mode: save/cancel gone, edit/clear back
    await expect(host.locator('#topicSaveBtn')).toHaveCount(0);
    await expect(host.locator('#topicCancelEditBtn')).toHaveCount(0);
    await expect(host.locator('#topicEditBtn')).toBeVisible();
    await expect(host.locator('#topicClearBtn')).toBeVisible();

    // Label shows on host and guest
    await expect(dispHost).toContainText(label, { timeout: 6_000 });
    await expect(dispGuest).toContainText(label, { timeout: 6_000 });

    // Clear on host
    await host.locator('#topicClearBtn').click();

    // Expect "–" (en dash) on both sides
    await expect(dispHost).toHaveText('–', { timeout: 6_000 });
    await expect(dispGuest).toHaveText('–', { timeout: 6_000 });

    await ctxHost.close();
    await ctxGuest.close();
  });
});
