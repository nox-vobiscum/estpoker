// Prod: verify deck composition by sequence
// - fib.scrum: no ∞, specials present
// - fib.enh: ∞ present, specials present
// - pow2: no ∞, specials present

import { test, expect, Page, Browser } from '@playwright/test';
import { roomUrlFor, newRoomCode, ensureMenuOpen, ensureMenuClosed } from './_setup/prod-helpers.js';

async function pickSequence(page, value) {
  await ensureMenuOpen(page);

  // Select the radio directly for stability on prod
  const radio = page.locator(`#menuSeqChoice input[name="menu-seq"][value="${value}"]`);
  await expect(radio, `Missing radio for value="${value}"`).toHaveCount(1);

  // Use .check() on the input instead of clicking the label
  await radio.check({ force: true });

  await ensureMenuClosed(page);
  await page.waitForTimeout(200); // allow WS roundtrip + UI rebuild
}

async function expectSpecialsVisible(page) {
  await expect(page.getByRole('button', { name: '❓', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '☕', exact: true })).toBeVisible();
}

test('Deck composition matches sequence rules in prod', async ({ page }) => {
  const roomCode = newRoomCode('PROD-DECK');
  await page.goto(roomUrlFor('Host', roomCode), { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#cardGrid')).toBeVisible();

  // fib.scrum: ∞ must NOT be present; specials must be present
  await pickSequence(page, 'fib.scrum');
  await expect(page.getByRole('button', { name: '∞', exact: true })).toHaveCount(0);
  await expectSpecialsVisible(page);

  // fib.enh: ∞ must be present; specials must be present
  await pickSequence(page, 'fib.enh');
  await expect(page.getByRole('button', { name: '∞', exact: true })).toHaveCount(1);
  await expectSpecialsVisible(page);

  // pow2: ∞ must NOT be present; specials must be present
  await pickSequence(page, 'pow2');
  await expect(page.getByRole('button', { name: '∞', exact: true })).toHaveCount(0);
  await expectSpecialsVisible(page);
});
