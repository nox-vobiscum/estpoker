// i18n runtime smoke: switching language updates <html lang>, label, flags, and tooltips exist
// Run:
//   npx playwright test tests/i18n-switch.spec.js
// Env:
//   EP_BASE_URL  (e.g. http://localhost:8080 or https://ep.noxvobiscum.at)
//   EP_ROOM_URL  (optional full room URL; overrides base; test appends participant & room)

const { test, expect } = require('@playwright/test');

function resolveRoomUrl() {
  const base = process.env.EP_BASE_URL || 'http://localhost:8080';
  const room = process.env.EP_ROOM_URL || `${base.replace(/\/$/, '')}/room?participantName=I18N&roomCode=I18N-${Date.now().toString(36).slice(-6)}`;
  if (process.env.EP_ROOM_URL) {
    const u = new URL(room);
    if (!u.searchParams.get('participantName')) u.searchParams.set('participantName', 'I18N');
    if (!u.searchParams.get('roomCode')) u.searchParams.set('roomCode', `I18N-${Date.now().toString(36).slice(-6)}`);
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

test.describe('i18n switch', () => {
  test('clicking language row flips lang, label and flags', async ({ page }) => {
    await page.goto(resolveRoomUrl(), { waitUntil: 'domcontentloaded' });
    await ensureMenuOpen(page);

    // Attach a listener for the custom lang-changed event (best-effort)
    await page.evaluate(() => {
      window.__epE2E_langEv = 0;
      document.addEventListener('ep:lang-changed', () => { window.__epE2E_langEv++; });
    });

    // Snapshot initial state
    const initialLang = (await page.evaluate(() => document.documentElement.getAttribute('lang') || 'en')).toLowerCase();
    const targetLang = initialLang.startsWith('de') ? 'en' : 'de';
    const beforeLabel = (await page.locator('#langCurrent').textContent() || '').trim();

    // Also capture theme-light tooltip existence (should exist after switch)
    const beforeTip = await page.locator('#themeLight').getAttribute('data-tooltip');

    // Click the language row
    await page.locator('#langRow').click();

    // Wait for <html lang> to flip OR the custom event to fire
    await page.waitForFunction((lang) => {
      const htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
      return htmlLang.startsWith(lang) || (window.__epE2E_langEv || 0) > 0;
    }, targetLang);

    // Verify <html lang>
    const afterLang = (await page.evaluate(() => document.documentElement.getAttribute('lang') || '')).toLowerCase();
    expect(afterLang.startsWith(targetLang)).toBeTruthy();

    // Label must match the language chosen (menu.js sets this explicitly)
    const afterLabel = (await page.locator('#langCurrent').textContent() || '').trim();
    if (targetLang === 'de') {
      expect(afterLabel).toBe('Deutsch');
    } else {
      expect(afterLabel).toBe('English');
    }

    // Flags should match the language split
    const flagA = page.locator('#langRow .flag-a');
    const flagB = page.locator('#langRow .flag-b');
    const srcA = (await flagA.getAttribute('src')) || '';
    const srcB = (await flagB.getAttribute('src')) || '';
    if (targetLang === 'de') {
      expect(srcA.endsWith('/flags/de.svg')).toBeTruthy();
      expect(srcB.endsWith('/flags/at.svg')).toBeTruthy();
    } else {
      expect(srcA.endsWith('/flags/us.svg')).toBeTruthy();
      expect(srcB.endsWith('/flags/gb.svg')).toBeTruthy();
    }

    // Theme button tooltip should exist (content may differ per locale, but must not be empty)
    const tipLight = await page.locator('#themeLight').getAttribute('data-tooltip');
    expect(tipLight && tipLight.trim().length > 0).toBeTruthy();

    // Optional: if tooltip existed before, it may change after switching; we allow equality too
    // (No assert here to avoid failing when localized strings equal fallback.)

    // Close the menu to avoid overlay intercepts for any follow-up tests
    await page.locator('#menuButton').click();
    await expect(page.locator('#appMenuOverlay')).toBeHidden();
  });
});
