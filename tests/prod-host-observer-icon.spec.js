// Prod-friendly host-side check: when the user toggles participation OFF,
// the host list shows the observer icon 👁 for that user; when toggled ON,
// the icon disappears. Pure DOM assertions, prod-safe timing.

import { test, expect } from '@playwright/test';
import {
  roomUrlFor,
  newRoomCode,
  ensureMenuOpen,
  ensureMenuClosed,
} from './_setup/prod-helpers.js';

function hostRowLocator(hostPage, name) {
  // Be robust to either legacy (.participant-row) or compact (.p-row) layouts
  const legacy = hostPage.locator('#liveParticipantList .participant-row').filter({ hasText: name });
  const compact = hostPage.locator('.p-row').filter({ hasText: name });
  return legacy.count().then(c => c > 0 ? legacy : compact);
}

test('Host list shows/removes observer icon when user toggles participation', async ({ page, browser }) => {
  const roomCode = newRoomCode('PROD-HOSTOBS');
  const host = page;
  const user = await browser.newPage();

  // Host + user join same room
  await host.goto(roomUrlFor('Host', roomCode), { waitUntil: 'domcontentloaded' });
  await user.goto(roomUrlFor('Viewer', roomCode), { waitUntil: 'domcontentloaded' });

  // Sanity: grids visible
  await expect(host.locator('#cardGrid')).toBeVisible();
  await expect(user.locator('#cardGrid')).toBeVisible();

  // Find host-side row for "Viewer"
  const row = await hostRowLocator(host, 'Viewer');
  await expect(row).toHaveCount(1);

  const eyeIcon = row.locator('.status-icon.observer');

  // --- Turn user into observer (OFF) ---
  await ensureMenuOpen(user);
  const partToggle = user.locator('#menuParticipationToggle');
  await expect(partToggle).toHaveCount(1);
  if (await partToggle.isChecked()) {
    await partToggle.setChecked(false);
  } else {
    await partToggle.click({ force: true });
  }
  await ensureMenuClosed(user);

  // Wait until host sees observer icon
  await host.waitForFunction(() => {
    const row = Array.from(document.querySelectorAll('#liveParticipantList .participant-row, .p-row'))
      .find(el => /Viewer/.test(el.textContent || ''));
    return !!row && !!row.querySelector('.status-icon.observer');
  });
  await expect(eyeIcon).toHaveCount(1);

  // --- Back to estimating (ON) ---
  await ensureMenuOpen(user);
  if (!await partToggle.isChecked()) {
    await partToggle.setChecked(true);
  } else {
    await partToggle.click({ force: true });
  }
  await ensureMenuClosed(user);

  // Wait until observer icon disappears on host
  await host.waitForFunction(() => {
    const row = Array.from(document.querySelectorAll('#liveParticipantList .participant-row, .p-row'))
      .find(el => /Viewer/.test(el.textContent || ''));
    return !!row && !row.querySelector('.status-icon.observer');
  });
  await expect(eyeIcon).toHaveCount(0);
});
