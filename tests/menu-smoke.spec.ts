// Menu smoke test: open/close overlay, verify toggles and optional sequence radios
// Run:
//   npx playwright test tests/menu-smoke.spec.js
// Env:
//   EP_BASE_URL  (e.g. http://localhost:8080 or https://ep.noxvobiscum.at)
//   EP_ROOM_URL  (optional full room URL; overrides base; test appends participant & room)

import { test, expect, Page, Browser } from '@playwright/test';

function resolveRoomUrl() {
  const base = process.env.EP_BASE_URL || 'http://localhost:8080';
  const room = process.env.EP_ROOM_URL || `${base.replace(/\/$/, '')}/room?participantName=MenuSmoke&roomCode=MENU-${Date.now().toString(36).slice(-6)}`;
  if (process.env.EP_ROOM_URL) {
    const u = new URL(room);
    if (!u.searchParams.get('participantName')) u.searchParams.set('participantName', 'MenuSmoke');
    if (!u.searchParams.get('roomCode')) u.searchParams.set('roomCode', `MENU-${Date.now().toString(36).slice(-6)}`);
    return u.toString();
  }
  return room;
}

async function ensureMenuOpen(page) {
  const overlay = page.locator('#appMenuOverlay');
  if (!(await overlay.isVisible().catch(() => false))) {
    await page.locator('#menuButton').click();
    await expect(overlay).toBeVisible();
  }
}

async function ensureMenuClosed(page) {
  const overlay = page.locator('#appMenuOverlay');
  if (await overlay.isVisible().catch(() => false)) {
    await page.locator('#menuButton').click();
    await expect(overlay).toBeHidden();
  }
}

test.describe('Menu smoke', () => {
  test('button opens/closes overlay and aria-expanded toggles', async ({ page }) => {
    await page.goto(resolveRoomUrl(), { waitUntil: 'domcontentloaded' });

    const btn = page.locator('#menuButton');
    const overlay = page.locator('#appMenuOverlay');
    const backdrop = page.locator('.menu-backdrop[data-close]');

    await expect(btn).toHaveCount(1);
    await expect(overlay).toHaveCount(1);

    // Initially closed
    await expect(overlay).toBeHidden();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');

    // Open via button
    await btn.click();
    await expect(overlay).toBeVisible();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');

    // Close via backdrop
    await expect(backdrop).toHaveCount(1);
    await backdrop.click({ force: true });
    await expect(overlay).toBeHidden();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  test('toggles exist and aria-checked mirrors state; sequence radios (if present)', async ({ page }) => {
    await page.goto(resolveRoomUrl(), { waitUntil: 'domcontentloaded' });
    await ensureMenuOpen(page);

    // Helper to flip a switch and verify aria-checked follows checked
    async function flipAndVerify(selector) {
      const el = page.locator(selector);
      if ((await el.count()) === 0) return { skipped: true, before: null, after: null };

      await expect(el).toHaveCount(1);
      await el.scrollIntoViewIfNeeded();

      const beforeChecked = await el.isChecked();
      await el.click({ force: true });
      await page.waitForTimeout(80);

      const afterChecked = await el.isChecked();
      if (afterChecked === beforeChecked) {
        await el.click({ force: true });
        await page.waitForTimeout(80);
      }

      const finalChecked = await el.isChecked();
      const aria = await el.getAttribute('aria-checked');
      expect(aria).toBe(String(finalChecked));

      // Restore original state (best-effort)
      if (finalChecked !== beforeChecked) {
        await el.click({ force: true });
        await page.waitForTimeout(60);
        const restored = await el.isChecked();
        expect(restored).toBe(beforeChecked);
      }

      return { skipped: false, before: beforeChecked, after: finalChecked };
    }

    // Three menu toggles
    const resAuto = await flipAndVerify('#menuAutoRevealToggle');
    const resTopic = await flipAndVerify('#menuTopicToggle');
    const resPart = await flipAndVerify('#menuParticipationToggle');

    // At least the Participation toggle should exist; others may be conditional
    expect(resPart.skipped).toBeFalsy();

    // Optional: sequence radios (may be hidden depending on server-side flags)
    const seqRoot = page.locator('#menuSeqChoice');
    if (await seqRoot.count()) {
      const radios = seqRoot.locator('input[type="radio"][name="menu-seq"]');
      const total = await radios.count();
      expect(total).toBeGreaterThan(0);

      // Allow 0 or 1 checked (WS/state may select later). But never >1.
      const checked = seqRoot.locator('input[type="radio"][name="menu-seq"]:checked');
      // brief grace in case selection arrives just after open
      await page.waitForTimeout(150);
      const checkedCount = await checked.count();
      expect(checkedCount <= 1).toBeTruthy();
    }

    await ensureMenuClosed(page);
  });
});
