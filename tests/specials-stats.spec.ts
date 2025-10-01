// Specials beeinflussen den Durchschnitt nicht.
// Votes: [number, ☕, number] (3 Teilnehmer) → Reveal → ☕-Chip sichtbar,
// Durchschnitt ≈ Mittelwert der Zahlen (Toleranz).

import { test, expect } from '@playwright/test';
import { roomUrlFor, newRoomCode } from './utils/env';

async function ensureMenuOpen(page) {
  const overlay = page.locator('#appMenuOverlay');
  const aria = await overlay.getAttribute('aria-hidden').catch(() => null);
  if (aria !== 'false') await page.locator('#menuButton').click();
  await expect(overlay).toHaveAttribute('aria-hidden', 'false');
}
async function ensureMenuClosed(page) {
  const overlay = page.locator('#appMenuOverlay');
  const aria = await overlay.getAttribute('aria-hidden').catch(() => null);
  if (aria === 'false') await page.locator('#menuButton').click();
  await expect(overlay).toHaveAttribute('aria-hidden', 'true');
}

async function readDeckValues(page): Promise<string[]> {
  const byAttr = await page.$$eval('#cardGrid [data-value]', els =>
    els.map(el => (el.getAttribute('data-value') || '').trim()).filter(Boolean)
  );
  if (byAttr.length) return byAttr;
  const byText = await page.$$eval('#cardGrid button, #cardGrid .card', els =>
    els.map(el => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  );
  return byText;
}
const isNumeric = (s: string) => /^-?\d+(?:[.,]\d+)?$/.test(s);

async function ensureNumericFriendlyDeck(page) {
  const hasTwoNums = async () => (await readDeckValues(page)).filter(isNumeric).length >= 2;
  if (await hasTwoNums()) return;

  await ensureMenuOpen(page);
  const root = '#menuSeqChoice';
  const candidates = ['fib.enh', 'fib.scrum', 'pow2'];
  for (const val of candidates) {
    const inputSel = `${root} input[name="menu-seq"][value="${val}"]`;
    const input = page.locator(inputSel).first();
    if (!(await input.count())) continue;

    if (await input.isEnabled().catch(() => false)) {
      await input.check({ force: true });
    } else {
      const id = await input.getAttribute('id');
      if (id) {
        const lab = page.locator(`${root} label[for="${id}"]`).first();
        if (await lab.count()) await lab.click({ force: true });
      }
      const row = page.locator(`${root} label.radio-row:has(input[value="${val}"])`).first();
      if (await row.count()) await row.click({ force: true });
      const any = page.locator(`${root} [data-value="${val}"]`).first();
      if (await any.count()) await any.click({ force: true });
      await page.evaluate((sel: string) => {
        const el = document.querySelector<HTMLInputElement>(sel);
        if (!el) return;
        el.checked = true;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, inputSel);
    }

    await ensureMenuClosed(page);
    await page.waitForTimeout(200);
    if (await hasTwoNums()) return;
    await ensureMenuOpen(page);
  }
  await ensureMenuClosed(page);
}

async function clickByValue(page, v: string) {
  const byAttr = page.locator(
    `#cardGrid [data-value="${v}"], #cardGrid [data-card="${v}"], #cardGrid [data-label="${v}"]`
  ).first();
  if (await byAttr.count()) { await byAttr.click({ force: true }); return true; }
  const exact = page.locator('#cardGrid button, #cardGrid .card', { hasText: new RegExp(`^\\s*${v}\\s*$`) }).first();
  if (await exact.count()) { await exact.click({ force: true }); return true; }
  const loose = page.locator('#cardGrid button, #cardGrid .card').filter({ hasText: v }).first();
  if (await loose.count()) { await loose.click({ force: true }); return true; }
  return false;
}
async function hasCoffeeCard(page) {
  if ((await page.locator('#cardGrid button, #cardGrid .card', { hasText: '☕' }).count()) > 0) return true;
  return (await page.locator('#cardGrid [data-test="card-coffee"], #cardGrid [data-value="☕"]').count()) > 0;
}
async function ensureReveal(host) {
  const btn = host.locator('#revealButton');
  if (await btn.count() && await btn.isVisible().catch(() => false)) {
    await btn.click();
    return;
  }
  await host.locator('#menuButton').click().catch(() => {});
  const reveal = host.locator(
    '#menuRevealBtn, [data-test="menu-reveal"], #revealRow button, button:has-text("Reveal"), button:has-text("Aufdecken")'
  ).first();
  await expect(reveal).toHaveCount(1);
  await reveal.click({ force: true });
}
async function readAverage(page): Promise<number | null> {
  const candidates = [
    '#avgValue', '.avg-value', '#statAverage .value', '.stat-average .value',
    '#results .average', '#stats .average', '[data-stat="avg"]', '[data-key="avg"]'
  ];
  for (const sel of candidates) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      const t = (await el.innerText().catch(() => '')).trim();
      const num = parseFloat(t.replace(',', '.'));
      if (!Number.isNaN(num)) return num;
    }
  }
  const blob = await page.locator('#results, #stats, #resultPanel, .results, .stats').allInnerTexts().catch(() => []);
  const m = blob.join(' ').match(/(-?\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

test('Specials do not affect average — votes [num, ☕, num] ⇒ mean(numbers)', async ({ browser }) => {
  const room = newRoomCode('SPECIALS');

  const ctxHost = await browser.newContext();
  const ctxG1  = await browser.newContext();
  const ctxG2  = await browser.newContext();
  const host   = await ctxHost.newPage();
  const g1     = await ctxG1.newPage();
  const g2     = await ctxG2.newPage();

  await host.goto(roomUrlFor('Host', room), { waitUntil: 'domcontentloaded' });
  await g1.goto  (roomUrlFor('G1',   room), { waitUntil: 'domcontentloaded' });
  await g2.goto  (roomUrlFor('G2',   room), { waitUntil: 'domcontentloaded' });

  await ensureNumericFriendlyDeck(host);
  await g1.waitForTimeout(150);

  const deck = await readDeckValues(host);
  const nums = deck.filter(isNumeric);
  expect(nums.length).toBeGreaterThanOrEqual(2);
  const a = nums[0]!, b = nums[1]!;
  const aNum = parseFloat(a.replace(',', '.'));
  const bNum = parseFloat(b.replace(',', '.'));

  expect(await hasCoffeeCard(host)).toBeTruthy();

  expect(await clickByValue(host, a)).toBeTruthy();
  const coffee = g1.locator('#cardGrid button, #cardGrid .card', { hasText: '☕' }).first();
  if (await coffee.count()) { await coffee.click({ force: true }); }
  else { expect(await clickByValue(g1, '☕')).toBeTruthy(); }
  expect(await clickByValue(g2, b)).toBeTruthy();

  await ensureReveal(host);

  const coffeeChip = host.locator('#results, #stats, #resultPanel, body').locator('text=☕').first();
  await expect(coffeeChip).toBeVisible();

  const avg = await readAverage(host);
  expect(avg).not.toBeNull();
  const expected = (aNum + bNum) / 2;
  expect(Math.abs((avg as number) - expected)).toBeLessThan(0.25);

  await ctxHost.close(); await ctxG1.close(); await ctxG2.close();
});
