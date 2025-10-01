// Prod: verify deck composition differs by sequence; specials present in all
import { test, expect } from '@playwright/test';
import { roomUrlFor, newRoomCode, ensureMenuOpen, ensureMenuClosed } from './_setup/prod-helpers.js';

async function pickSequence(page, value: string) {
  await ensureMenuOpen(page);
  const radio = page.locator(`#menuSeqChoice input[name="menu-seq"][value="${value}"]`);
  await expect(radio, `Missing radio for value="${value}"`).toHaveCount(1);
  await radio.check({ force: true });
  await ensureMenuClosed(page);
  await page.waitForTimeout(220);
}

async function readDeckValues(page): Promise<string[]> {
  // Try data attributes first
  const dataVals = await page.$$eval('#cardGrid [data-value]', els =>
    els.map(el => (el.getAttribute('data-value') || '').trim()).filter(Boolean)
  );
  if (dataVals.length) return dataVals;

  // Fallback: visible text content of card buttons
  const txt = await page.$$eval('#cardGrid button, #cardGrid .card', els =>
    els.map(el => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  );
  return txt;
}

async function specialsPresent(page) {
  const q = page.locator('#cardGrid button, #cardGrid .card', { hasText: '❓' });
  const c = page.locator('#cardGrid button, #cardGrid .card', { hasText: '☕' });
  if ((await q.count()) > 0 && (await c.count()) > 0) return true;

  const alt = page.locator(
    '#cardGrid [data-test="card-help"], ' +
    '#cardGrid [data-test="card-coffee"], ' +
    '#cardGrid button[title*="help" i], ' +
    '#cardGrid button[aria-label*="help" i], ' +
    '#cardGrid button[title*="coffee" i], ' +
    '#cardGrid button[aria-label*="coffee" i]'
  );
  return (await alt.count()) > 0;
}

function asSet(arr: string[]): Set<string> {
  return new Set(arr);
}

test('Deck composition matches sequence rules in prod', async ({ page }) => {
  const roomCode = newRoomCode('PROD-DECK');
  await page.goto(roomUrlFor('Host', roomCode), { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#cardGrid')).toBeVisible();

  // fib.scrum
  await pickSequence(page, 'fib.scrum');
  const deckScrum = await readDeckValues(page);
  expect(deckScrum.length).toBeGreaterThan(0);
  expect(await specialsPresent(page)).toBe(true);

  // fib.enh
  await pickSequence(page, 'fib.enh');
  const deckEnh = await readDeckValues(page);
  expect(deckEnh.length).toBeGreaterThan(0);
  expect(await specialsPresent(page)).toBe(true);

  // pow2
  await pickSequence(page, 'pow2');
  const deckPow2 = await readDeckValues(page);
  expect(deckPow2.length).toBeGreaterThan(0);
  expect(await specialsPresent(page)).toBe(true);

  // Decks must differ across sequences
  expect(JSON.stringify([...asSet(deckEnh)])).not.toBe(JSON.stringify([...asSet(deckScrum)]));
  expect(JSON.stringify([...asSet(deckPow2)])).not.toBe(JSON.stringify([...asSet(deckEnh)]));
});
