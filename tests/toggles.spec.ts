// tests/toggles.spec.js
import { test, expect, Page, Browser } from '@playwright/test';
import { roomUrlFor, newRoomCode, ensureMenuOpen, ensureMenuClosed } from './_setup/prod-helpers.js';

test.describe('Menu → Room toggle event contracts', () => {

  test('page loads without console errors', async ({ page }) => {
    const code = newRoomCode('TOG');
    const url = roomUrlFor('E2E', code);
    const messages = [];
    page.on('console', m => messages.push(m));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    // Small settle
    await page.waitForTimeout(150);
    const severe = messages.filter(m => ['error'].includes(m.type())).map(m => m.text());
    expect(severe.join('\n')).toBe('');
  });

  test('auto-reveal / topic / participation dispatch correct CustomEvents', async ({ page }) => {
    const roomCode = newRoomCode('TOG');
    await page.addInitScript(() => {
      window.__epE2EEvents = [];
      document.addEventListener('ep:auto-reveal-toggle', e => window.__epE2EEvents.push({ name: 'ep:auto-reveal-toggle', d: e.detail }));
      document.addEventListener('ep:topic-toggle', e => window.__epE2EEvents.push({ name: 'ep:topic-toggle', d: e.detail }));
      document.addEventListener('ep:participation-toggle', e => window.__epE2EEvents.push({ name: 'ep:participation-toggle', d: e.detail }));
    });

    await page.goto(roomUrlFor('E2E', roomCode), { waitUntil: 'domcontentloaded' });
    await ensureMenuOpen(page);

    async function toggle(selector) {
      const el = page.locator(selector);
      await expect(el, `Missing element ${selector}`).toHaveCount(1);
      const before = await el.isChecked().catch(() => undefined);
      await el.click({ force: true });
      await page.waitForTimeout(60);
      const after = await el.isChecked().catch(() => undefined);
      return { before, after };
    }

    // Auto-reveal
    if (await page.locator('#menuAutoRevealToggle').count()) {
      await toggle('#menuAutoRevealToggle');
      await page.waitForFunction(() => window.__epE2EEvents.some(e => e.name === 'ep:auto-reveal-toggle' && 'on' in (e.d || {})));
    }

    // Topic
    await toggle('#menuTopicToggle');
    await page.waitForFunction(() => window.__epE2EEvents.some(e => e.name === 'ep:topic-toggle' && 'on' in (e.d || {})));

    // Participation
    await toggle('#menuParticipationToggle');
    await page.waitForFunction(() => window.__epE2EEvents.some(e => e.name === 'ep:participation-toggle' && 'estimating' in (e.d || {})));

    await ensureMenuClosed(page);
  });
});
