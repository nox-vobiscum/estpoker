import { test, expect, Page } from '@playwright/test';
import { roomUrlFor, newRoomCode } from './utils/env';
import { waitTopicVisibility, forceTopicToggle } from './utils/topic';

async function closeAnyMenus(page: Page) {
  const overlay = page.locator('#appMenuOverlay, [data-test="menu-overlay"], #menuPanel');
  if (await overlay.isVisible().catch(() => false)) {
    const toggle = page.locator('#menuButton, [data-test="menu-button"], button[aria-label="Menu"]');
    if (await toggle.count()) await toggle.first().click().catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
    await expect(overlay).toBeHidden({ timeout: 1500 }).catch(() => {});
  }
}

async function ensureHostRole(page: Page, timeout = 8000) {
  await expect(page.locator('body')).toHaveClass(/is-host/, { timeout });
}

async function setTopicLabel(page: Page, label: string) {
  await closeAnyMenus(page);
  const row = page.locator('#topicRow');
  await expect(row).toHaveCount(1);
  await expect(page.locator('#topicEditBtn')).toBeVisible();
  await page.locator('#topicEditBtn').click();
  const input = row.locator('#topicDisplay');
  await expect(input).toBeVisible();
  await input.fill(label);
  await expect(row.locator('#topicSaveBtn')).toBeVisible();
  await row.locator('#topicSaveBtn').click();
  await expect(row.locator('input#topicDisplay')).toHaveCount(0, { timeout: 2000 });
}

async function clearTopicLabel(page: Page) {
  await closeAnyMenus(page);
  await page.locator('#topicClearBtn').click();
}

test.describe('Topic flow', () => {
  test('Show/Hide via menu toggle propagates to host and guest', async ({ browser }) => {
    const code = newRoomCode('TPC');
    const ctxHost = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host = await ctxHost.newPage();
    await host.goto(roomUrlFor('Host', code), { waitUntil: 'domcontentloaded' });
    await ensureHostRole(host);
    const guest = await ctxGuest.newPage();
    await guest.goto(roomUrlFor('Guest', code), { waitUntil: 'domcontentloaded' });
    await expect(host.locator('#liveParticipantList .participant-row')).toHaveCount(2);

    await forceTopicToggle(host, true);
    await closeAnyMenus(host);
    await waitTopicVisibility(host, true, 10_000);
    await waitTopicVisibility(guest, true, 10_000);
    await expect(guest.locator('#topicEditBtn, #topicClearBtn')).toHaveCount(0);
    await forceTopicToggle(host, false);
    await closeAnyMenus(host);
    await waitTopicVisibility(host, false, 10_000);
    await waitTopicVisibility(guest, false, 10_000);
    await forceTopicToggle(host, true);
    await closeAnyMenus(host);
    await waitTopicVisibility(host, true, 10_000);
    await waitTopicVisibility(guest, true, 10_000);

    await ctxHost.close();
    await ctxGuest.close();
  });

  test('Edit and Clear propagate to host and guest', async ({ browser }) => {
    const code = newRoomCode('TPC');
    const ctxHost = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host = await ctxHost.newPage();
    await host.goto(roomUrlFor('Host', code), { waitUntil: 'domcontentloaded' });
    await ensureHostRole(host);
    const guest = await ctxGuest.newPage();
    await guest.goto(roomUrlFor('Guest', code), { waitUntil: 'domcontentloaded' });
    await expect(host.locator('#liveParticipantList .participant-row')).toHaveCount(2);

    await forceTopicToggle(host, true);
    await closeAnyMenus(host);
    await waitTopicVisibility(host, true, 10_000);
    await waitTopicVisibility(guest, true, 10_000);

    const label = `Story ${Date.now().toString(36).slice(-4)}`;
    await setTopicLabel(host, label);
    await expect(host.locator('#topicDisplay')).toHaveText(label);
    await expect(guest.locator('#topicDisplay')).toHaveText(label);
    await expect(guest.locator('#topicEditBtn, #topicClearBtn')).toHaveCount(0);

    await clearTopicLabel(host);
    await expect(host.locator('#topicDisplay')).toHaveText(/^[–—]$/);
    await expect(guest.locator('#topicDisplay')).toHaveText(/^[–—]$/);

    await ctxHost.close();
    await ctxGuest.close();
  });

  test('Empty Save and Cancel close the editor', async ({ page }) => {
    const code = newRoomCode('TPC');
    await page.goto(roomUrlFor('Host', code), { waitUntil: 'domcontentloaded' });
    await ensureHostRole(page);
    await forceTopicToggle(page, true);
    await closeAnyMenus(page);
    await waitTopicVisibility(page, true, 10_000);

    await setTopicLabel(page, 'Story to remove');
    await page.locator('#topicEditBtn').click();
    await page.locator('#topicDisplay').fill('');
    await page.locator('#topicSaveBtn').click();
    await expect(page.locator('#topicDisplay')).toHaveText(/^[–—]$/);
    await expect(page.locator('#topicSaveBtn')).toHaveCount(0);

    await page.locator('#topicEditBtn').click();
    await page.locator('#topicCancelEditBtn').click();
    await expect(page.locator('#topicDisplay')).toHaveText(/^[–—]$/);
    await expect(page.locator('#topicCancelEditBtn')).toHaveCount(0);
  });
});
