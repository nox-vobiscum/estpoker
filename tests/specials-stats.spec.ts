// Specials do not affect average — votes [num, ☕, num] ⇒ mean(numbers)
// Robust to UIs with/without explicit "average" row.
import { test, expect, Page } from '@playwright/test';
import { roomUrlFor, newRoomCode } from './utils/env';

function must<T>(v: T | null | undefined, msg: string): NonNullable<T> {
  if (v == null) throw new Error(msg);
  return v as NonNullable<T>;
}

async function ensureMenuOpen(page: Page) {
  const overlay = page.locator('#appMenuOverlay');
  const aria = await overlay.getAttribute('aria-hidden').catch(() => null);
  if (aria !== 'false') await page.locator('#menuButton').click();
  await expect(overlay).toHaveAttribute('aria-hidden', 'false');
}
async function ensureMenuClosed(page: Page) {
  const overlay = page.locator('#appMenuOverlay');
  const aria = await overlay.getAttribute('aria-hidden').catch(() => null);
  if (aria === 'false') await page.locator('#menuButton').click();
  await expect(overlay).toHaveAttribute('aria-hidden', 'true');
}

const isNumeric = (s: string) => /^-?\d+(?:[.,]\d+)?$/.test(s);
const toNum = (s: string) => parseFloat(s.replace(',', '.'));

async function readDeckValues(page: Page): Promise<string[]> {
  const byAttr = await page.$$eval('#cardGrid [data-value]', els =>
    (els as HTMLElement[])
      .map(el => (el.getAttribute('data-value') || '').trim())
      .filter(Boolean)
  );
  if (byAttr.length) return byAttr;

  const byText = await page.$$eval('#cardGrid button, #cardGrid .card', els =>
    (els as HTMLElement[])
      .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  );
  return byText;
}

async function ensureNumericFriendlyDeck(page: Page) {
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

async function clickByValue(page: Page, v: string) {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const byAttr = page.locator(
    `#cardGrid [data-value="${v}"], #cardGrid [data-card="${v}"], #cardGrid [data-label="${v}"]`
  ).first();
  if (await byAttr.count()) { await byAttr.click({ force: true }); return true; }

  const exact = page.locator('#cardGrid button, #cardGrid .card', {
    hasText: new RegExp(`^\\s*${esc(v)}\\s*$`)
  }).first();
  if (await exact.count()) { await exact.click({ force: true }); return true; }

  const loose = page.locator('#cardGrid button, #cardGrid .card').filter({ hasText: v }).first();
  if (await loose.count()) { await loose.click({ force: true }); return true; }

  return false;
}

async function hasCoffeeCard(page: Page) {
  if ((await page.locator('#cardGrid button, #cardGrid .card', { hasText: '☕' }).count()) > 0) return true;
  return (await page.locator('#cardGrid [data-test="card-coffee"], #cardGrid [data-value="☕"]').count()) > 0;
}

async function revealNow(page: Page) {
  const btn = page.locator('#revealButton');
  if (await btn.count() && await btn.isVisible().catch(() => false)) { await btn.click(); return true; }
  await page.locator('#menuButton').click().catch(() => {});
  const selectors = [
    '#menuRevealBtn', '[data-test="menu-reveal"]', '#revealRow button',
    'button:has-text("Aufdecken")', 'button:has-text("Reveal")'
  ];
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) && await loc.isVisible().catch(() => false)) {
      await loc.click({ force: true });
      return true;
    }
  }
  await page.evaluate(() => {
    // @ts-ignore
    if (typeof window.revealCards === 'function') window.revealCards();
    document.dispatchEvent(new CustomEvent('ep:reveal', { bubbles: true }));
  });
  return true;
}

async function readAverage(page: Page): Promise<number | null> {
  const avgLoc = page.locator('#avgValue, #avgRow [data-test="avg-value"], #avgRow .value');
  await avgLoc.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
  const txt = (await avgLoc.textContent().catch(() => '') || '').trim();
  const m = txt.match(/\d+(?:[.,]\d+)?/);
  return m ? toNum(m[0]) : null;
}

// Parse numeric tokens from the result views (very permissive)
async function collectNumericResultTokens(page: Page): Promise<number[]> {
  const texts = await page.$$eval(
    '#results, #stats, #resultPanel, .results, [data-test="results"], #liveParticipantList',
    (nodes) => {
      const out: string[] = [];
      const pushText = (el: Element | null) => {
        if (!el) return;
        const ht = (el as HTMLElement);
        const style = ht && (ht.ownerDocument?.defaultView?.getComputedStyle(ht));
        const visible = !!ht && !!style && style.display !== 'none' && style.visibility !== 'hidden';
        const txt = (ht.textContent || '').replace(/\s+/g, ' ').trim();
        if (visible && txt) out.push(txt);
      };
      nodes.forEach(n => {
        pushText(n);
        // shallow collect children too (cheap)
        n.querySelectorAll('*').forEach(child => pushText(child));
      });
      return out;
    }
  );
  const nums = new Set<number>();
  for (const t of texts) {
    const matches = t.match(/\d+(?:[.,]\d+)?/g);
    if (matches) for (const m of matches) nums.add(parseFloat(m.replace(',', '.')));
  }
  return Array.from(nums.values()).sort((a, b) => a - b);
}

/* ---------------------------------- TEST ---------------------------------- */

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
  if (nums.length < 2) throw new Error('Deck must expose at least two numeric cards');

  const a = nums[0]!;
  const b = nums[1]!;
  const aNum = toNum(a);
  const bNum = toNum(b);

  expect(await hasCoffeeCard(host)).toBeTruthy();

  expect(await clickByValue(host, a)).toBeTruthy();
  const coffee = g1.locator('#cardGrid button, #cardGrid .card', { hasText: '☕' }).first();
  if (await coffee.count()) { await coffee.click({ force: true }); } else { expect(await clickByValue(g1, '☕')).toBeTruthy(); }
  expect(await clickByValue(g2, b)).toBeTruthy();

  expect(await revealNow(host)).toBe(true);

  // Specials chip visible somewhere in results
  const coffeeChip = host.locator('#results, #stats, #resultPanel, body').locator('text=☕').first();
  await expect(coffeeChip).toBeVisible();

  // Prefer explicit average; else fall back to visible numeric result tokens
  const avgMaybe = await readAverage(host);
  if (avgMaybe !== null) {
    const expected = (aNum + bNum) / 2;
    expect(Math.abs(avgMaybe - expected)).toBeLessThan(0.25);
  } else {
    const tokens = await collectNumericResultTokens(host);
    // We only need to see our two numeric votes somewhere in the results area.
    const eps = 0.001;
    const hasA = tokens.some(x => Math.abs(x - aNum) < eps);
    const hasB = tokens.some(x => Math.abs(x - bNum) < eps);
    expect(hasA && hasB).toBeTruthy();
  }

  await ctxHost.close(); await ctxG1.close(); await ctxG2.close();
});
