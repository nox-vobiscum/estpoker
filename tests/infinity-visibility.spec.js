// Infinity visibility: ∞ appears only in fib.enh sequence
import { test, expect } from '@playwright/test';
import { roomUrlFor, ensureMenuOpen, ensureMenuClosed } from './utils/helpers.js';

function newCode() { return 'INF-' + Math.random().toString(36).slice(2, 7); }

test('∞ is visible only for "fib.enh" and hidden for others', async ({ page }) => {
  await page.goto(roomUrlFor('DeckUser', newCode()), { waitUntil: 'domcontentloaded' });

  // open menu once
  await ensureMenuOpen(page);

  // helper to choose a sequence by value, then close menu to see cards
  async function selectSeq(value) {
    const radio = page.locator(`#menuSeqChoice input[name="menu-seq"][value="${value}"]`);
    await expect(radio).toHaveCount(1);
    await radio.check();
    await page.waitForTimeout(180); // WS roundtrip + reset
    await ensureMenuClosed(page);
  }

  // helper to check if ∞ button exists in grid
  async function infinityVisible() {
    return (await page.getByRole('button', { name: '∞', exact: true }).count()) > 0;
  }

  // fib.scrum → no infinity
  await selectSeq('fib.scrum');
  expect(await infinityVisible()).toBe(false);

  // fib.math → no infinity
  await ensureMenuOpen(page);
  await selectSeq('fib.math');
  expect(await infinityVisible()).toBe(false);

  // pow2 → no infinity
  await ensureMenuOpen(page);
  await selectSeq('pow2');
  expect(await infinityVisible()).toBe(false);

  // tshirt → no infinity
  await ensureMenuOpen(page);
  await selectSeq('tshirt');
  expect(await infinityVisible()).toBe(false);

  // fib.enh → infinity visible
  await ensureMenuOpen(page);
  await selectSeq('fib.enh');
  expect(await infinityVisible()).toBe(true);
});
