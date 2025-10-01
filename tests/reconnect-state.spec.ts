// Reconnect state: nach Reveal + Reset sieht ein Nicht-Host nach Refresh wieder die Pre-Vote-UI.

import { test, expect } from '@playwright/test';
import { roomUrlFor, newRoomCode } from './utils/env';

// Menü
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

// Deck/Sequenz
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

async function pickTwoPlayable(page): Promise<[string, string]> {
  const all = await readDeckValues(page);
  const nums = all.filter(isNumeric);
  if (nums.length >= 2) return [nums[0]!, nums[1]!] as [string, string];
  return [all[0]!, all[1]!] as [string, string];
}
async function clickCardByValue(page, value: string) {
  const byAttr = page.locator(
    `#cardGrid [data-value="${value}"], #cardGrid [data-card="${value}"], #cardGrid [data-label="${value}"]`
  ).first();
  if (await byAttr.count()) { await byAttr.click({ force: true }); return true; }

  const esc = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exact = page.locator('#cardGrid button, #cardGrid .card', { hasText: new RegExp(`^\\s*${esc}\\s*$`) }).first();
  if (await exact.count()) { await exact.click({ force: true }); return true; }

  const loose = page.locator('#cardGrid button, #cardGrid .card').filter({ hasText: value }).first();
  if (await loose.count()) { await loose.click({ force: true }); return true; }

  return false;
}

async function revealNow(page) {
  const btn = page.locator('#revealButton');
  if (await btn.count() && await btn.isVisible().catch(() => false)) {
    await btn.click();
    return true;
  }
  await page.locator('#menuButton').click().catch(() => {});
  const reveal = page.locator(
    '#menuRevealBtn, [data-test="menu-reveal"], #revealRow button, button:has-text("Reveal"), button:has-text("Aufdecken")'
  ).first();
  if (await reveal.count()) { await reveal.click({ force: true }); return true; }
  return false;
}

test('Refresh after reset shows pre-vote UI for a non-host', async ({ browser }) => {
  const room = newRoomCode('RECON');

  const ctxHost = await browser.newContext();
  const ctxGuest = await browser.newContext();
  const host  = await ctxHost.newPage();
  const guest = await ctxGuest.newPage();

  await host.goto(roomUrlFor('Host',  room), { waitUntil: 'domcontentloaded' });
  await guest.goto(roomUrlFor('Guest', room), { waitUntil: 'domcontentloaded' });

  await ensureNumericFriendlyDeck(host);
  await guest.waitForTimeout(150);

  const [a, b] = await pickTwoPlayable(host);
  expect(await clickCardByValue(host,  a)).toBeTruthy();
  expect(await clickCardByValue(guest, b)).toBeTruthy();

  const revealed = await revealNow(host);
  expect(revealed, 'Could not trigger reveal via button/menu').toBe(true);

  // Reset per Button oder Menü
  const resetBtn = host.locator('#resetButton');
  if (await resetBtn.count() && await resetBtn.isVisible().catch(() => false)) {
    await resetBtn.click();
  } else {
    await host.locator('#menuButton').click().catch(() => {});
    const resetMenu = host.locator(
      '#menuResetBtn, [data-test="menu-reset"], button:has-text("Reset"), button:has-text("Zurücksetzen")'
    ).first();
    await expect(resetMenu).toHaveCount(1);
    await resetMenu.click({ force: true });
  }

  // Guest refresh → Pre-Vote (keine ausgewählte Karte)
  await guest.reload({ waitUntil: 'domcontentloaded' });
  const selected = guest.locator('#cardGrid .selected, #cardGrid [aria-pressed="true"]');
  expect(await selected.count()).toBe(0);

  await ctxHost.close(); await ctxGuest.close();
});
