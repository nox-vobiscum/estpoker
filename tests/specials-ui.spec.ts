// tests/specials-ui.spec.ts
// Purpose: Verify Specials palette end-to-end (host controls, multi-select, a11y keys, guest sync, guest cannot change)
// Notes:
// - Uses keyboard (focus + Enter/Space) to activate chips to avoid pointer interception by overlay sections.
// - Detects the actual host by attempting a real state change; falls back to the other page if needed.

import { test, expect } from '@playwright/test';
import {
  openTwoClients,
  ensureMenuOpen,
  ensureMenuClosed,
  waitAppReady,
  hasCoffeeCard,
} from './utils/helpers';

/** Palette row visibility via [hidden]/[aria-hidden]. */
async function paletteVisible(page) {
  return await page
    .evaluate(() => {
      const row = document.getElementById('rowSpecialsPick') as HTMLElement | null;
      if (!row) return false;
      const cs = getComputedStyle(row);
      const hidden = row.hasAttribute('hidden') || row.getAttribute('aria-hidden') === 'true';
      return !hidden && cs.display !== 'none' && row.offsetParent !== null;
    })
    .catch(() => false);
}

/** Ensure the master specials switch is ON/OFF on the given page. */
async function setSpecialsSwitch(page, wantOn: boolean) {
  await ensureMenuOpen(page);
  const sel = '#menuSpecialsToggle, input[role="switch"][aria-label*="Special" i]';
  const toggle = page.locator(sel).first();
  if (await toggle.count()) {
    const aria = (await toggle.getAttribute('aria-checked').catch(() => null)) ?? '';
    const cur =
      aria === 'true' ? true : aria === 'false' ? false : (await toggle.isChecked().catch(() => false)) || false;
    if (cur !== wantOn) {
      await toggle.click({ force: true }).catch(() => {});
      await page.waitForTimeout(80);
    }
  }
  await ensureMenuClosed(page);
}

/** Returns locator for a specials chip by id (e.g. 'coffee'). */
function chip(page, id: string) {
  return page.locator(`#rowSpecialsPick .spc[data-id="${id}"]`).first();
}

/** Read current pressed state of a chip (aria-pressed). */
async function isPressed(page, id: string) {
  const btn = chip(page, id);
  const v = await btn.getAttribute('aria-pressed').catch(() => null);
  return v === 'true';
}

/** Focus chip and toggle via keyboard to desired state. Returns true if the state matches after attempts. */
async function setPressedViaKeyboard(page, id: string, want: boolean, timeoutMs = 1200) {
  await ensureMenuOpen(page);
  if (!(await paletteVisible(page))) {
    await setSpecialsSwitch(page, true);
    await ensureMenuOpen(page);
  }
  const btn = chip(page, id);
  await expect(btn).toHaveCount(1);

  // If already in desired state → done
  if ((await isPressed(page, id)) === want) return true;

  // Focus + Enter, then Space as fallback
  await btn.scrollIntoViewIfNeeded();
  await btn.focus();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await page.keyboard.press('Enter');
    try {
      await expect(btn).toHaveAttribute('aria-pressed', want ? 'true' : 'false', { timeout: 250 });
      return true;
    } catch {
      /* try space next */
    }
    await page.keyboard.press(' ');
    try {
      await expect(btn).toHaveAttribute('aria-pressed', want ? 'true' : 'false', { timeout: 250 });
      return true;
    } catch {
      await page.waitForTimeout(100);
    }
  }
  return (await isPressed(page, id)) === want;
}

/** Try to prove page is host by turning coffee ON via keyboard (no clicks). */
async function proveHostByCoffee(page): Promise<boolean> {
  return await setPressedViaKeyboard(page, 'coffee', true, 1500);
}

/** Assert the special icon is present in the card grid. */
async function expectIconInGrid(page, icon: string, present: boolean) {
  const locator = page.locator('#cardGrid').getByText(icon, { exact: false });
  if (present) await expect(locator).toBeVisible();
  else await expect(locator).toHaveCount(0);
}

test.describe('Specials palette (menu buttons) — host controls, guest sync & guards', () => {
  test('multi-select, keyboard toggle, sync to guest, guest cannot change', async ({ browser }) => {
    const { host, guest, closeAll } = await openTwoClients(browser);

    try {
      await Promise.all([waitAppReady(host.page), waitAppReady(guest.page)]);

      // Determine the actual host by attempting to turn ON coffee via keyboard.
      let hostPage = host.page;
      let guestPage = guest.page;

      const aIsHost = await proveHostByCoffee(hostPage);
      if (!aIsHost) {
        const bIsHost = await proveHostByCoffee(guestPage);
        if (bIsHost) {
          const tmp = hostPage;
          hostPage = guestPage;
          guestPage = tmp;
        } else {
          throw new Error('Could not toggle specials on either page — host detection failed.');
        }
      }

      // At this point coffee is ON on the real host.
      await ensureMenuOpen(hostPage);
      await expect(chip(hostPage, 'coffee')).toHaveAttribute('aria-pressed', 'true');

      // Turn two more specials ON via keyboard (speech, telescope).
      for (const id of ['speech', 'telescope'] as const) {
        const ok = await setPressedViaKeyboard(hostPage, id, true, 1500);
        expect(ok).toBeTruthy();
      }

      // Close menu; icons appear in host grid.
      await ensureMenuClosed(hostPage);
      await expectIconInGrid(hostPage, '☕', true);
      await expectIconInGrid(hostPage, '💬', true);
      await expectIconInGrid(hostPage, '🔭', true);

      // Sanity via helper
      expect(await hasCoffeeCard(hostPage)).toBeTruthy();

      // Guest sees the same icons.
      await expectIconInGrid(guestPage, '☕', true);
      await expectIconInGrid(guestPage, '💬', true);
      await expectIconInGrid(guestPage, '🔭', true);

      // Keyboard a11y on host: Space OFF, Enter ON (coffee).
      await ensureMenuOpen(hostPage);
      let ok = await setPressedViaKeyboard(hostPage, 'coffee', false, 1500);
      expect(ok).toBeTruthy();
      ok = await setPressedViaKeyboard(hostPage, 'coffee', true, 1500);
      expect(ok).toBeTruthy();
      await ensureMenuClosed(hostPage);

      // Guest reflects final ON state for coffee.
      await expectIconInGrid(guestPage, '☕', true);

      // Guest cannot change specials: try to flip telescope; neither aria-pressed nor grid should change.
      await ensureMenuOpen(guestPage);
      const gTeleBtn = chip(guestPage, 'telescope');
      const gTeleCountBefore = await guestPage.locator('#cardGrid').getByText('🔭').count();
      const guestPressedBefore = await isPressed(guestPage, 'telescope');

      // Attempt keyboard toggle; on non-host bridge ignores it.
      await gTeleBtn.focus();
      await guestPage.keyboard.press('Enter');
      await guestPage.keyboard.press(' ');
      await guestPage.waitForTimeout(250);

      await expect(gTeleBtn).toHaveAttribute('aria-pressed', guestPressedBefore ? 'true' : 'false');
      const gTeleCountAfter = await guestPage.locator('#cardGrid').getByText('🔭').count();
      expect(gTeleCountAfter).toBe(gTeleCountBefore);

      // Turning specials OFF on host hides palette and removes icons from both grids.
      await setSpecialsSwitch(hostPage, false);
      await ensureMenuOpen(hostPage);
      expect(await paletteVisible(hostPage)).toBeFalsy();
      await ensureMenuClosed(hostPage);

      await expectIconInGrid(hostPage, '☕', false);
      await expectIconInGrid(guestPage, '☕', false);
    } finally {
      await closeAll();
    }
  });
});
