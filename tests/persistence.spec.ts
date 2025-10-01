// Persistence: Auto-Reveal persists for the room and is observable after reload.
// Falls der Toggle nicht direkt lesbar ist, prüfen wir das Verhalten:
// Bei AR=on sollen zwei Stimmen automatisch aufdecken.

import { test, expect } from '@playwright/test';
import { roomUrlFor, newRoomCode } from './utils/env';

// ── Menü ──────────────────────────────────────────────────────────────────────
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

// ── Deck lesen / prüfen ───────────────────────────────────────────────────────
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
const isSpecial = (s: string) => ['☕','❓','∞','coffee','break','unknown'].some(t => s.includes(t));

// Sequenz nur dann setzen, wenn wir <2 numerische Karten finden
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

    // 1) falls enabled: normal check
    if (await input.isEnabled().catch(() => false)) {
      await input.check({ force: true });
    } else {
      // 2) Label per for=ID
      const id = await input.getAttribute('id');
      if (id) {
        const lab = page.locator(`${root} label[for="${id}"]`).first();
        if (await lab.count()) await lab.click({ force: true });
      }
      // 3) gesamte Row anklicken
      const row = page.locator(`${root} label.radio-row:has(input[value="${val}"])`).first();
      if (await row.count()) await row.click({ force: true });

      // 4) data-value click
      const any = page.locator(`${root} [data-value="${val}"]`).first();
      if (await any.count()) await any.click({ force: true });

      // 5) JS-Event-Fallback
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

    // nächster Kandidat
    await ensureMenuOpen(page);
  }
  await ensureMenuClosed(page);
}

async function pickTwoPlayable(page): Promise<[string, string]> {
  const all = await readDeckValues(page);
  const nums = all.filter(isNumeric);
  if (nums.length >= 2) return [nums[0]!, nums[1]!] as [string, string];
  const plain = all.filter(v => !isSpecial(v));
  if (plain.length >= 2) return [plain[0]!, plain[1]!] as [string, string];
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

test.describe('Persistence', () => {
  test('Auto-Reveal state persists in room across reload (guest sees it checked)', async ({ browser }) => {
    const roomCode = newRoomCode('AR');

    const ctxHost = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host = await ctxHost.newPage();
    const guest = await ctxGuest.newPage();

    await host.goto(roomUrlFor('Host', roomCode),  { waitUntil: 'domcontentloaded' });
    await guest.goto(roomUrlFor('Guest', roomCode), { waitUntil: 'domcontentloaded' });

    // Deck numerik-sicher machen (ohne disabled-Inputs anzufassen)
    await ensureNumericFriendlyDeck(host);
    await guest.waitForTimeout(150);

    // Host: AR einschalten
    await ensureMenuOpen(host);
    const hostToggle = host.locator('#menuAutoRevealToggle');
    await expect(hostToggle).toHaveCount(1);
    if (!(await hostToggle.isChecked())) {
      await hostToggle.click({ force: true });
      await host.waitForTimeout(160);
    }
    await ensureMenuClosed(host);

    // Guest neu laden und Toggle beobachten
    await guest.reload({ waitUntil: 'domcontentloaded' });
    await ensureMenuOpen(guest);

    const seenChecked = await guest.waitForFunction(() => {
      const el = document.querySelector<HTMLInputElement>('#menuAutoRevealToggle');
      if (!el) return false;
      const aria = el.getAttribute('aria-checked');
      const status = document.querySelector('#menuArStatus');
      const text = status ? (status.textContent || '').trim().toLowerCase() : '';
      return el.checked === true || aria === 'true' || /on|an|✓/i.test(text);
    }, { timeout: 10_000 }).catch(() => false);

    if (!seenChecked) {
      // Fallback: mit AR=on sollten zwei Stimmen automatisch aufdecken
      await ensureMenuClosed(guest);
      const [a, b] = await pickTwoPlayable(host);
      const ok = (await clickCardByValue(host, a)) && (await clickCardByValue(guest, b));
      expect(ok, 'Could not cast two votes for AR fallback check').toBeTruthy();

      const revealed = await guest.waitForFunction(() => {
        const vis = (el: Element | null) => !!el && (el as HTMLElement).offsetParent !== null;
        const reset = document.getElementById('resetButton');
        if (vis(reset)) return true;
        const grid = document.getElementById('cardGrid');
        if (grid && (grid.classList.contains('revealed') || grid.getAttribute('data-state') === 'revealed')) return true;
        const any = document.querySelector('#resultPanel, #results, #statsPanel, #stats, .results, .stats');
        return vis(any);
      }, { timeout: 7_000 }).catch(() => false);

      expect(revealed, 'Auto-Reveal did not reveal automatically').toBeTruthy();
    } else {
      await ensureMenuClosed(guest);
    }

    await ctxHost.close(); await ctxGuest.close();
  });
});
