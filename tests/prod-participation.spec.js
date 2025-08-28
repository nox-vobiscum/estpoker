// Prod: Participation → Observer mode disables voting and reflects in host list
// - User toggles Participation OFF → all their cards disabled, host sees 👁
// - User toggles Participation ON  → cards enabled again, 👁 verschwindet

import { test, expect } from '@playwright/test';
import { roomUrlFor, newRoomCode, ensureMenuOpen, ensureMenuClosed } from './_setup/prod-helpers.js';

test('Participation toggle on prod: observer disables voting and updates host list', async ({ page }) => {
  const room = newRoomCode('PROD-OBS');

  // Host & User öffnen
  await page.goto(roomUrlFor('Host', room), { waitUntil: 'domcontentloaded' });
  const user = await page.context().newPage();
  await user.goto(roomUrlFor('Viewer', room), { waitUntil: 'domcontentloaded' });

  // Grund-UI sichtbar
  await expect(page.locator('#cardGrid')).toBeVisible();
  await expect(user.locator('#cardGrid')).toBeVisible();

  // Warten bis beide Zeilen da sind
  const rows = page.locator('#liveParticipantList .participant-row');
  await expect(rows).toHaveCount(2);

  // Exakt nach Namen in der Namenszelle matchen (nicht "Make host"-Button!)
  const hostRow   = rows.filter({ has: page.locator('.name, .p-name', { hasText: /^Host$/ }) });
  const viewerRow = rows.filter({ has: page.locator('.name, .p-name', { hasText: /^Viewer$/ }) });
  await expect(hostRow).toHaveCount(1);
  await expect(viewerRow).toHaveCount(1);

  // --- User -> Observer (OFF) ---
  await ensureMenuOpen(user);
  const userToggle = user.locator('#menuParticipationToggle');
  await expect(userToggle).toHaveCount(1);
  if (await userToggle.isChecked()) {
    await userToggle.click({ force: true });
  }
  await ensureMenuClosed(user);

  // Auf User-Seite: alle Karten disabled
  await user.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('#cardGrid button'));
    return btns.length > 0 && btns.every(b => b.disabled);
  });

  // Auf Host-Seite: 👁-Icon beim Viewer
  await expect(viewerRow.locator('.status-icon.observer')).toHaveCount(1);

  // --- User -> Estimating (ON) ---
  await ensureMenuOpen(user);
  if (!(await userToggle.isChecked())) {
    await userToggle.click({ force: true });
  }
  await ensureMenuClosed(user);

  // Auf User-Seite: mind. eine Karte wieder enabled
  await user.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('#cardGrid button'));
    return btns.length > 0 && btns.some(b => !b.disabled);
  });

  // Auf Host-Seite: 👁-Icon weg
  await expect(viewerRow.locator('.status-icon.observer')).toHaveCount(0);
});
