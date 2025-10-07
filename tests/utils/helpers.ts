/**
 * tests/utils/helpers.ts
 * Lean, stable helpers using IDs with optional data-test fallbacks.
 * No locale text matching. Attribute/ID-driven waits only.
 */

import type { Page } from '@playwright/test';
export { baseUrl, roomUrlFor, newRoomCode } from './env';

/* ------------------------- menu open/close (stable) ------------------------ */

export async function ensureMenuOpen(page: Page): Promise<void> {
  const overlay = page.locator('[data-test="menu-overlay"], #appMenuOverlay');
  await overlay.waitFor({ state: 'attached' }).catch(() => {});
  const aria = await overlay.getAttribute('aria-hidden').catch(() => null);
  if (aria !== 'false') {
    const btn = page.locator('[data-test="menu-open"], #menuButton').first();
    if (await btn.count()) await btn.click().catch(() => {});
  }
  await page
    .waitForFunction(() => {
      const el =
        document.querySelector('[data-test="menu-overlay"]') ||
        document.querySelector('#appMenuOverlay');
      return !!el && el.getAttribute('aria-hidden') === 'false';
    })
    .catch(() => {});
}

export async function ensureMenuClosed(page: Page): Promise<void> {
  const overlay = page.locator('[data-test="menu-overlay"], #appMenuOverlay');
  await overlay.waitFor({ state: 'attached' }).catch(() => {});
  const aria = await overlay.getAttribute('aria-hidden').catch(() => null);
  if (aria === 'false') {
    const btn = page.locator('[data-test="menu-open"], #menuButton').first();
    if (await btn.count()) await btn.click().catch(() => {});
  }
  await page
    .waitForFunction(() => {
      const el =
        document.querySelector('[data-test="menu-overlay"]') ||
        document.querySelector('#appMenuOverlay');
      return !!el && el.getAttribute('aria-hidden') === 'true';
    })
    .catch(() => {});
}

/* ---------------------------------- deck ---------------------------------- */

export async function readDeckValues(page: Page): Promise<string[]> {
  // Prefer explicit value attribute
  const byAttr = await page
    .$$eval(
      '#cardGrid [data-value], [data-test="deck"] [data-value], [data-test="card"]',
      (els) =>
        els
          .map((el) => (el.getAttribute('data-value') || '').trim())
          .filter(Boolean)
    )
    .catch(() => [] as string[]);
  if (byAttr.length) return byAttr;

  // Fallback to visible text
  const byText = await page
    .$$eval('#cardGrid button, #cardGrid .card', (els) =>
      els
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    )
    .catch(() => [] as string[]);

  return byText;
}

export async function clickByValue(page: Page, v: string): Promise<boolean> {
  const attr = page
    .locator(
      `[data-test="card"][data-value="${v}"], #cardGrid [data-value="${v}"], #cardGrid [data-card="${v}"], #cardGrid [data-label="${v}"]`
    )
    .first();
  if (await attr.count()) {
    await attr.click().catch(() => {});
    return true;
  }
  // exact text (fallback)
  const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exact = page
    .locator('#cardGrid button, #cardGrid .card', { hasText: new RegExp(`^\\s*${esc}\\s*$`) })
    .first();
  if (await exact.count()) {
    await exact.click().catch(() => {});
    return true;
  }
  return false;
}

export async function pickTwoNumeric(page: Page): Promise<[string, string] | null> {
  const until = Date.now() + 2500;
  const isNum = (s: string) => /^-?\d+(?:[.,]\d+)?$/.test(s);
  while (Date.now() < until) {
    const vals = await readDeckValues(page);
    const nums = vals.filter(isNum);
    if (nums.length >= 2) return [nums[0]!, nums[1]!];
    await page.waitForTimeout(80);
  }
  return null;
}

/* ------------------------------ reveal / reset ----------------------------- */

export async function revealedNow(page: Page, timeoutMs = 2500): Promise<boolean> {
  const ok = await page
    .waitForFunction(() => {
      const vis = (sel: string) => {
        const el = document.querySelector<HTMLElement>(sel);
        return !!el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
      };
      return (
        vis('[data-test="reset"], #resetButton') ||
        vis('[data-test="results"], #results, #resultPanel') ||
        vis('[data-test="stats"], #stats') ||
        vis('[data-test="avg-value"], #avgValue, #avgRow .value') ||
        document.body.classList.contains('revealed')
      );
    }, { timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
  return ok;
}

export async function waitPreVote(page: Page, timeoutMs = 2500): Promise<boolean> {
  const ok = await page
    .waitForFunction(() => {
      const sel =
        (document.querySelector('#cardGrid .selected, #cardGrid [aria-pressed="true"]') as
          | HTMLElement
          | null) ?? null;
      const res =
        (document.querySelector(
          '[data-test="results"], [data-test="stats"], #results, #stats, #resultPanel, .results, .stats'
        ) as HTMLElement | null) ?? null;
      const reset = (document.querySelector('[data-test="reset"], #resetButton') as
        | HTMLElement
        | null) ?? null;
      const gone = (el: HTMLElement | null) => !el || el.offsetParent === null;
      return gone(sel) && gone(res) && gone(reset);
    }, { timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
  return ok;
}

export async function revealNow(page: Page): Promise<boolean> {
  // 1) page button (ID or data-test)
  const content = page.locator('[data-test="reveal"], #revealButton, #revealRow button').first();
  if (await content.count()) {
    await content.click().catch(() => {});
    if (await revealedNow(page, 2500)) return true;
  }
  // 2) menu entry
  await ensureMenuOpen(page);
  const menu = page.locator('[data-test="menu-reveal"], #menuRevealBtn').first();
  if (await menu.count()) {
    await menu.click().catch(() => {});
    await ensureMenuClosed(page);
    if (await revealedNow(page, 2500)) return true;
  } else {
    await ensureMenuClosed(page);
  }
  // 3) JS fallback
  await page
    .evaluate(() => {
      // @ts-ignore
      if (typeof (window as any).revealCards === 'function') (window as any).revealCards();
      document.dispatchEvent(new CustomEvent('ep:reveal', { bubbles: true }));
    })
    .catch(() => {});
  return revealedNow(page, 1500);
}

export async function resetNow(page: Page): Promise<boolean> {
  // 1) page reset button
  const content = page.locator('[data-test="reset"], #resetButton').first();
  if (await content.count()) {
    await content.click().catch(() => {});
    return waitPreVote(page, 2500);
  }
  // 2) menu entry
  await ensureMenuOpen(page);
  const menu = page.locator('[data-test="menu-reset"], #menuResetBtn').first();
  if (await menu.count()) {
    await menu.click().catch(() => {});
    await ensureMenuClosed(page);
    return waitPreVote(page, 2500);
  }
  await ensureMenuClosed(page);

  // 3) JS fallback
  await page
    .evaluate(() => {
      // @ts-ignore
      if (typeof (window as any).resetRound === 'function') (window as any).resetRound();
      document.dispatchEvent(new CustomEvent('ep:reset', { bubbles: true }));
    })
    .catch(() => {});
  return waitPreVote(page, 2500);
}

/* ------------------------------- sequences -------------------------------- */

export async function getSelectedSequenceId(page: Page): Promise<string | null> {
  return await page
    .evaluate(() => {
      const el = document.querySelector<HTMLInputElement>(
        '#menuSeqChoice input[name="menu-seq"]:checked, [data-test="seq-choice"] input[name="menu-seq"]:checked'
      );
      return el?.value ?? null;
    })
    .catch(() => null);
}

export async function setSequence(page: Page, value: string): Promise<void> {
  await ensureMenuOpen(page);
  const inputSel = `#menuSeqChoice input[name="menu-seq"][value="${value}"], [data-test="seq-choice"] input[name="menu-seq"][value="${value}"]`;
  const input = page.locator(inputSel).first();
  if (await input.count()) {
    await input.check({ force: true }).catch(() => {});
  }
  await ensureMenuClosed(page);
  await page.waitForTimeout(80);
}

export async function waitSeq(page: Page, expectValue: string, timeoutMs = 3000): Promise<boolean> {
  const ok = await page
    .waitForFunction(
      (val: string) => {
        const el = document.querySelector<HTMLInputElement>(
          '#menuSeqChoice input[name="menu-seq"]:checked, [data-test="seq-choice"] input[name="menu-seq"]:checked'
        );
        return el?.value === val;
      },
      expectValue,
      { timeout: timeoutMs }
    )
    .then(() => true)
    .catch(() => false);
  return ok;
}
