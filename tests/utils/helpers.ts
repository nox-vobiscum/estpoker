/**
 * tests/utils/helpers.ts
 *
 * Purpose
 * -------
 * Stable, build-agnostic helpers for common UI operations in Playwright tests.
 * These functions avoid CSS-visibility races and rely on attribute-based checks
 * that are consistent across languages, themes, and environments.
 *
 * Conventions
 * -----------
 * - Prefer explicit IDs / data-test hooks; fall back to robust text only if needed.
 * - Avoid arbitrary timeouts; poll for attribute/visibility based state instead.
 * - Keep helpers tolerant across implementations (menu vs inline buttons, etc.).
 */

// Bridge module: re-export canonical ENV helpers and keep UI helpers here.
import type { Page, Browser } from '@playwright/test';

// Pull env values into local scope so we can use them here…
import { baseUrl, roomUrlFor, newRoomCode } from './env';

// …and re-export them to keep the public surface identical.
export { baseUrl, roomUrlFor, newRoomCode };

/* ---------------------------- tiny util helpers ---------------------------- */

export function must<T>(v: T | null | undefined, msg: string): NonNullable<T> {
  if (v == null) throw new Error(msg);
  return v as NonNullable<T>;
}

export const isNumeric = (s: string) => /^-?\d+(?:[.,]\d+)?$/.test(s);
export const toNum = (s: string) => parseFloat(s.replace(',', '.'));

// Open two independent clients (host + guest) in the same room.
export async function openTwoClients(browser: Browser) {
  const code = newRoomCode();
  const hostName = 'Host';
  const guestName = 'Guest';

  const mkUrl = (name: string) =>
    `${baseUrl.replace(/\/$/, '')}/room` +
    `?roomCode=${encodeURIComponent(code)}` +
    `&participantName=${encodeURIComponent(name)}` +
    `&preflight=1`;

  const ctxHost = await browser.newContext();
  const ctxGuest = await browser.newContext();

  const hostPage = await ctxHost.newPage();
  const guestPage = await ctxGuest.newPage();

  await Promise.all([
    hostPage.goto(mkUrl(hostName), { waitUntil: 'domcontentloaded' }),
    guestPage.goto(mkUrl(guestName), { waitUntil: 'domcontentloaded' }),
  ]);

  // Wait until the app is usable
  const waitReady = (p: Page) =>
    p.waitForFunction(
      () =>
        !!document.getElementById('cardGrid') ||
        document.documentElement.hasAttribute('data-ready'),
      { timeout: 5000 }
    ).catch(() => {});

  await Promise.all([waitReady(hostPage), waitReady(guestPage)]);

  return {
    code,
    host: { page: hostPage, name: hostName },
    guest: { page: guestPage, name: guestName },
    closeAll: async () => {
      await Promise.allSettled([ctxGuest.close(), ctxHost.close()]);
    },
  };
}


/* --------------------------------- menu ----------------------------------- */

/**
 * Ensures the app menu is open. Uses aria-hidden instead of relying on CSS visibility.
 */
export async function ensureMenuOpen(page: Page): Promise<void> {
  const btn = page.locator('#menuButton');
  const overlay = page.locator('#appMenuOverlay');

  await overlay.waitFor({ state: 'attached' }).catch(() => {});
  const aria = await overlay.getAttribute('aria-hidden').catch(() => null);
  if (aria !== 'false') {
    await btn.click().catch(() => {});
  }

  await page
    .waitForFunction(() => {
      const el = document.getElementById('appMenuOverlay');
      return !!el && el.getAttribute('aria-hidden') === 'false';
    })
    .catch(() => {});
}

/**
 * Ensures the app menu is closed. Prefer toggling via the button, attribute-based waiting.
 */
export async function ensureMenuClosed(page: Page): Promise<void> {
  const btn = page.locator('#menuButton');
  const overlay = page.locator('#appMenuOverlay');

  await overlay.waitFor({ state: 'attached' }).catch(() => {});
  const isOpen = (await overlay.getAttribute('aria-hidden').catch(() => null)) === 'false';
  if (isOpen) {
    await btn.click().catch(() => {});
  }

  await page
    .waitForFunction(() => {
      const el = document.getElementById('appMenuOverlay');
      return !!el && el.getAttribute('aria-hidden') === 'true';
    })
    .catch(() => {});
}

/* --------------------------------- deck ----------------------------------- */

export async function readDeckValues(page: Page): Promise<string[]> {
  const byAttr = await page
    .$$eval('#cardGrid [data-value]', els =>
      els.map(el => (el.getAttribute('data-value') || '').trim()).filter(Boolean)
    )
    .catch(() => [] as string[]);
  if (byAttr.length) return byAttr;

  const byText = await page
    .$$eval('#cardGrid button, #cardGrid .card', els =>
      els.map(el => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    )
    .catch(() => [] as string[]);

  return byText;
}

export async function clickByValue(page: Page, v: string): Promise<boolean> {
  const byAttr = page
    .locator(
      `#cardGrid [data-value="${v}"], #cardGrid [data-card="${v}"], #cardGrid [data-label="${v}"]`
    )
    .first();
  if (await byAttr.count()) {
    await byAttr.click({ force: true });
    return true;
  }

  const exact = page
    .locator('#cardGrid button, #cardGrid .card', {
      hasText: new RegExp(`^\\s*${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`),
    })
    .first();
  if (await exact.count()) {
    await exact.click({ force: true });
    return true;
  }

  const loose = page
    .locator('#cardGrid button, #cardGrid .card')
    .filter({ hasText: v })
    .first();
  if (await loose.count()) {
    await loose.click({ force: true });
    return true;
  }

  return false;
}

export async function hasCoffeeCard(page: Page): Promise<boolean> {
  if (
    (await page
      .locator('#cardGrid button, #cardGrid .card', { hasText: '☕' })
      .count()) > 0
  )
    return true;
  if (
    (await page
      .locator('#cardGrid [data-test="card-coffee"], #cardGrid [data-value="☕"]')
      .count()) > 0
  )
    return true;
  return false;
}

/**
 * Returns any two numeric values currently visible in the deck.
 */
export async function pickTwoNumeric(page: Page): Promise<[string, string] | null> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const deck = await readDeckValues(page);
    const nums = deck.filter(isNumeric);
    if (nums.length >= 2) return [nums[0]!, nums[1]!];
    await page.waitForTimeout(100);
  }
  return null;
}

/**
 * Clicks any numeric card available. Returns true if a click was performed.
 */
export async function voteAnyNumber(page: Page): Promise<boolean> {
  const deck = await readDeckValues(page);
  const pick = deck.find(isNumeric);
  return pick ? clickByValue(page, pick) : false;
}

/* ------------------------------ reveal / reset ----------------------------- */

export async function revealedNow(page: Page, timeoutMs = 4000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await page
      .evaluate(() => {
        const vis = (sel: string) => {
          const el = document.querySelector<HTMLElement>(sel);
          if (!el) return false;
          const cs = getComputedStyle(el);
          const hidden =
            el.hasAttribute('hidden') || cs.display === 'none' || cs.visibility === 'hidden';
          return !hidden && el.offsetParent !== null;
        };
        // Reset visible → very likely revealed state
        if (vis('#resetButton')) return true;
        // New structure
        if (vis('#resultRow')) return true;
        // Legacy structures
        if (vis('#results') || vis('#stats') || vis('#resultPanel')) return true;
        // Class / average fallback
        if (document.body.classList.contains('revealed')) return true;
        const avg = document.querySelector('#avgValue, #avgRow, #averageVote');
        return !!avg && (avg as HTMLElement).offsetParent !== null;
      })
      .catch(() => false);
    if (ok) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

export async function revealNow(page: Page): Promise<boolean> {
  // 1) visible button in content
  const contentBtn = page.locator('#revealRow button:visible, #revealButton:visible').first();
  if (await contentBtn.count()) {
    await contentBtn.click().catch(() => {});
    if (await revealedNow(page, 3000)) return true;
  }

  // 2) via menu
  await ensureMenuOpen(page);
  const menuBtn = page
    .locator(
      '#menuRevealBtn:visible, [data-test="menu-reveal"]:visible, button:has-text("Reveal"):visible, button:has-text("Aufdecken"):visible'
    )
    .first();
  if (await menuBtn.count()) {
    await menuBtn.click().catch(() => {});
    await ensureMenuClosed(page);
    if (await revealedNow(page, 3000)) return true;
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
  return revealedNow(page, 2000);
}

/**
 * Wait until obvious pre-vote conditions: no selected chip, no reset button, no results panel.
 */
export async function waitPreVote(page: Page, timeoutMs = 4000): Promise<boolean> {
  return await page
    .waitForFunction(() => {
      const anySelected = !!document.querySelector(
        '#cardGrid .selected, #cardGrid [aria-pressed="true"]'
      );

      // Reset button must be gone
      const reset = document.getElementById('resetButton') as HTMLElement | null;
      const resetVisible =
        !!reset &&
        !reset.hasAttribute('hidden') &&
        getComputedStyle(reset).display !== 'none' &&
        reset.offsetParent !== null;

      // New result row visibility
      const row = document.getElementById('resultRow') as HTMLElement | null;
      const rowVisible =
        !!row &&
        !row.classList.contains('is-hidden') &&
        !row.hasAttribute('hidden') &&
        getComputedStyle(row).display !== 'none' &&
        row.offsetParent !== null;

      const revealedClass = document.body.classList.contains('revealed');

      // Pre-vote = no selection, no reset visible, no result row visible, no revealed class
      return !anySelected && !resetVisible && !rowVisible && !revealedClass;
    }, { timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
}

export async function resetNow(page: Page): Promise<boolean> {
  // Menu can block clicks
  try {
    await ensureMenuClosed(page);
  } catch {}

  const btn = page.locator('#resetButton').first();

  // Wait until the button is actually visible & enabled
  const ready = await page
    .waitForFunction(() => {
      const el = document.getElementById('resetButton') as HTMLElement | null;
      if (!el) return false;
      const cs = getComputedStyle(el);
      const hidden = el.hasAttribute('hidden') || cs.display === 'none' || cs.visibility === 'hidden';
      const disabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
      return !hidden && !disabled;
    }, { timeout: 2500 })
    .then(() => true)
    .catch(() => false);

  if (ready) {
    // normal → force → DOM-Click chain
    try {
      await btn.click();
    } catch {
      try {
        await btn.click({ force: true });
      } catch {
        await page.evaluate(
          () => (document.getElementById('resetButton') as HTMLElement | null)?.click()
        );
      }
    }
    if (await waitPreVote(page, 4000)) return true;
  }

  // Optional: menu fallback if present
  try {
    await ensureMenuOpen(page);
    const menuBtn = page.locator('#menuResetBtn, [data-test="menu-reset"]').first();
    if (await menuBtn.count()) {
      await menuBtn.click({ force: true }).catch(() => {});
      await ensureMenuClosed(page);
      if (await waitPreVote(page, 4000)) return true;
    } else {
      await ensureMenuClosed(page);
    }
  } catch {}

  // Last resort: global function + event
  await page
    .evaluate(() => {
      const w = window as any;
      if (typeof w.resetRoom === 'function') w.resetRoom();
      else if (typeof w.resetRound === 'function') w.resetRound();
      document.dispatchEvent(new CustomEvent('ep:reset', { bubbles: true }));
    })
    .catch(() => {});
  return await waitPreVote(page, 4000);
}

/* ------------------------------ sequences menu ----------------------------- */

export async function getSelectedSequenceId(page: Page): Promise<string | null> {
  return await page
    .evaluate(() => {
      const sel = document.querySelector<HTMLInputElement>(
        '#menuSeqChoice input[name="menu-seq"]:checked'
      );
      return sel?.value ?? null;
    })
    .catch(() => null);
}

export async function setSequence(page: Page, value: string): Promise<void> {
  await ensureMenuOpen(page);
  const inputSel = `#menuSeqChoice input[name="menu-seq"][value="${value}"]`;
  const input = page.locator(inputSel).first();

  if ((await input.count()) && (await input.isEnabled().catch(() => false))) {
    await input.check({ force: true }).catch(() => {});
  } else {
    // try label/row clicks
    const id = await input.getAttribute('id').catch(() => null);
    if (id) {
      const lab = page.locator(`#menuSeqChoice label[for="${id}"]`).first();
      if (await lab.count()) await lab.click({ force: true }).catch(() => {});
    }
    const row = page
      .locator(`#menuSeqChoice label.radio-row:has(input[value="${value}"])`)
      .first();
    if (await row.count()) await row.click({ force: true }).catch(() => {});
    // last resort: programmatic
    await page
      .evaluate((sel: string) => {
        const el = document.querySelector<HTMLInputElement>(sel);
        if (!el) return;
        el.checked = true;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, inputSel)
      .catch(() => {});
  }

  await ensureMenuClosed(page);
  await page.waitForTimeout(150);
}

export async function waitSeq(page: Page, expectValue: string, timeoutMs = 3000): Promise<boolean> {
  const ok = await page
    .waitForFunction(
      (val: string) => {
        const el = document.querySelector<HTMLInputElement>(
          '#menuSeqChoice input[name="menu-seq"]:checked'
        );
        return el?.value === val;
      },
      expectValue,
      { timeout: timeoutMs }
    )
    .catch(() => false);
  return ok === true;
}

/* ------------------------------- auto-reveal ------------------------------- */

/**
 * Reads Auto-Reveal state. Will briefly open/close the menu if needed.
 * Returns `true` if AR is ON, `false` otherwise.
 */
export async function getAutoRevealState(page: Page): Promise<boolean> {
  const overlay = page.locator('#appMenuOverlay');
  const wasOpen = (await overlay.getAttribute('aria-hidden').catch(() => null)) === 'false';

  if (!wasOpen) await ensureMenuOpen(page);

  const val = await page
    .evaluate(() => {
      const q = (sel: string) => document.querySelector<HTMLInputElement>(sel);
      const el =
        q('#menuAutoRevealToggle') ||
        q('input[role="switch"][aria-label*="Auto-Reveal" i]') ||
        q('input[type="checkbox"][aria-label*="Auto-Reveal" i]');
      if (!el) return false;
      const aria = el.getAttribute('aria-checked');
      if (aria === 'true') return true;
      if (aria === 'false') return false;
      // fallback: JS property
      return !!(el as any).checked;
    })
    .catch(() => false);

  if (!wasOpen) await ensureMenuClosed(page);
  return !!val;
}

/**
 * Attempts to set AR to desired value. Returns the final state read back.
 */
export async function setAutoReveal(page: Page, on: boolean): Promise<boolean> {
  await ensureMenuOpen(page);
  const toggle = page
    .locator(
      '#menuAutoRevealToggle, input[role="switch"][aria-label*="Auto-Reveal" i], input[type="checkbox"][aria-label*="Auto-Reveal" i]'
    )
    .first();

  if (await toggle.count()) {
    const current = await toggle.getAttribute('aria-checked').catch(() => null);
    const currentBool =
      current === 'true' ? true : current === 'false' ? false : await toggle.isChecked().catch(() => false);
    if (currentBool !== on) {
      await toggle.click({ force: true }).catch(() => {});
    }
  } else {
    // programmatic fallback
    await page
      .evaluate((want: boolean) => {
        const el =
          document.querySelector<HTMLInputElement>('#menuAutoRevealToggle') ||
          document.querySelector<HTMLInputElement>('input[role="switch"][aria-label*="Auto-Reveal" i]') ||
          document.querySelector<HTMLInputElement>('input[type="checkbox"][aria-label*="Auto-Reveal" i]');
        if (!el) return;
        (el as any).checked = want;
        el.setAttribute('aria-checked', String(want));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, on)
      .catch(() => {});
  }

  await ensureMenuClosed(page);
  await page.waitForTimeout(100);
  return getAutoRevealState(page);
}

/* --------------------------------- stats ---------------------------------- */

/**
 * Reads the average from visible stats if present, else tries to compute from visible numeric chips.
 */
export async function readAverage(page: Page): Promise<number | null> {
  // Try explicit avg row/value
  const avgLoc = page.locator('#avgValue, #avgRow [data-test="avg-value"], #avgRow .value, #averageVote');
  const shownExplicit = await avgLoc.first().isVisible().catch(() => false);
  if (shownExplicit) {
    const raw = (await avgLoc.first().textContent().catch(() => '') || '').trim();
    const m = raw.match(/(\d+(?:[.,]\d+)?)/);
    if (m && m[1]) return toNum(m[1]);
  } else {
    // wait briefly if it appears
    const appeared = await avgLoc
      .first()
      .waitFor({ state: 'visible', timeout: 1200 })
      .then(() => true)
      .catch(() => false);
    if (appeared) {
      const raw = (await avgLoc.first().textContent().catch(() => '') || '').trim();
      const m = raw.match(/(\d+(?:[.,]\d+)?)/);
      if (m && m[1]) return toNum(m[1]);
    }
  }

  // Fallback: compute from numeric chips in results area
  const nums = await page
    .$$eval(
      '#results .chip, #results [data-test="chip"], #stats .chip, #stats [data-test="chip"], #resultPanel .chip',
      els => els.map(el => (el.textContent || '').trim()).filter(Boolean)
    )
    .catch(() => [] as string[]);

  const values = nums
    .map(t => {
      const m = t.match(/-?\d+(?:[.,]\d+)?/);
      return m && m[0] ? m[0] : null;
    })
    .filter((x): x is string => !!x)
    .map(toNum);

  const onlyNums = values.filter(n => !Number.isNaN(n));
  if (onlyNums.length >= 2) {
    const sum = onlyNums.reduce((a, b) => a + b, 0);
    return sum / onlyNums.length;
  }

  return null;
}

  // ── Sequence helpers (UI-independent) ─────────────────────────────────────────
  
  /** Fire the same app event the menu would produce (stable, host-only). */
  export async function setSequenceViaEvent(page: Page, id: string) {
    await page.evaluate((seq) => {
      document.dispatchEvent(new CustomEvent('ep:sequence-change', { detail: { id: seq } }));
    }, id);
  }

  /** Oracle: is the infinity card in the grid? (⇔ fib.enh is active) */
  export async function deckHasInfinity(page: Page): Promise<boolean> {
    return page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLButtonElement>('#cardGrid button'))
        .some(b => (b.textContent || '').trim() === '♾️')
    );
  }

  /** Read the most recent sequenceId from the front-end event buffer (__epVU). */
  export async function lastSeqFromBus(page: Page): Promise<string | null> {
    return page.evaluate(() => {
      const bus = (window as any).__epVU as any[] | undefined;
      if (!bus || !bus.length) return null;
      for (let i = bus.length - 1; i >= 0; i--) {
        const m = bus[i];
        const sid = m?.sequenceId ?? (m?.type === 'voteUpdate' ? m.sequenceId : null);
        if (sid) return String(sid);
      }
      return null;
    });
  }

  // ---- App readiness & host-role waits ---------------------------------------

export async function waitAppReady(page: Page, timeoutMs = 4000): Promise<void> {
  await page
    .waitForFunction(
      () => document.documentElement.hasAttribute('data-ready'),
      { timeout: timeoutMs }
    )
    .catch(() => {});
}

export async function waitHostRole(page: Page, timeoutMs = 4000): Promise<void> {
  await page
    .waitForFunction(
      () => document.body.classList.contains('is-host'),
      { timeout: timeoutMs }
    )
    .catch(() => {});
}

export async function waitWsOpen(page: Page, timeoutMs = 4000): Promise<void> {
  await page
    .waitForFunction(
      () => (window as any).__epWs && (window as any).__epWs.readyState === 1,
      { timeout: timeoutMs }
    )
    .catch(() => {});
}

  /**
   * Try to set sequence via app event; if the deck does not reflect it, fall back to radio.
   * Returns true if the deck looks correct after the operation.
   */
  export async function setSequenceRobust(page: Page, id: string): Promise<boolean> {
    await waitAppReady(page);
    // 1) programmatic (menu would do this under the hood)
    await setSequenceViaEvent(page, id).catch(() => {});
    await page.waitForTimeout(60);

    const wantInfinity = id === 'fib.enh';
    const hasInf1 = await deckHasInfinity(page);

    if (wantInfinity === hasInf1) return true;

    // 2) fallback to radio path
    await setSequence(page, id);
    await page.waitForTimeout(120);

    const hasInf2 = await deckHasInfinity(page);
    return wantInfinity === hasInf2;
  }
