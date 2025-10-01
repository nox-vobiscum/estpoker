// tests/utils/topic.ts
import { expect, type Page } from '@playwright/test';

/**
 * Findet die Topic-Row tolerant (ID / data-test / Heuristik).
 */
export async function findTopicRowSelector(page: Page): Promise<string | null> {
  const candidates = [
    '#topicRow',
    '[data-test="topic-row"]',
    '#topic',
    '[data-topic-row]',
    '[id*="topic" i][class*="row" i]',
    '[id*="topic" i]',
    '[data-test*="topic" i]',
  ];
  for (const sel of candidates) {
    const n = await page.locator(sel).count().catch(() => 0);
    if (n > 0) return sel;
  }

  // Heuristik: über Display/Input nach oben laufen
  const parts = ['#topicDisplay', '[data-test="topic-display"]', '#topicInput', '[data-test="topic-input"]'];
  for (const p of parts) {
    const loc = page.locator(p).first();
    if (await loc.count()) {
      const handle = await loc.elementHandle();
      if (handle) {
        const found = await handle.evaluate((el) => {
          let n: HTMLElement | null = el as HTMLElement;
          for (let i = 0; i < 4 && n; i++) {
            const cls = String((n as HTMLElement).className || '').toLowerCase();
            if ((n.id && n.id.toLowerCase().includes('topic')) || cls.includes('topic')) return n;
            n = n.parentElement;
          }
          return null;
        });
        if (found) {
          const id = (found as HTMLElement).id;
          if (id) return `#${CSS.escape(id)}`;
        }
      }
    }
  }

  return null;
}

/**
 * Menü öffnen/schließen (robust, mehrere Selektoren).
 */
async function ensureMenuOpen(page: Page): Promise<boolean> {
  const overlay = page.locator('#appMenuOverlay, [data-test="menu-overlay"]');
  if (await overlay.isVisible().catch(() => false)) return false;

  const btn = page.locator('#menuButton, [data-test="menu-button"], button[aria-label="Menu"]');
  if ((await btn.count()) === 0) throw new Error('Menu button not found');
  await btn.first().click({ force: true });
  await expect(overlay).toBeVisible({ timeout: 3000 });
  return true;
}

async function ensureMenuClosed(page: Page): Promise<void> {
  const overlay = page.locator('#appMenuOverlay, [data-test="menu-overlay"]');
  if (!(await overlay.isVisible().catch(() => false))) return;

  const btn = page.locator('#menuButton, [data-test="menu-button"], button[aria-label="Menu"]');
  if ((await btn.count()) === 0) return;
  await btn.first().click({ force: true });
  await expect(overlay).toBeHidden({ timeout: 3000 });
}

/**
 * Sichtbarkeit der Topic-Zeile abwarten (erst ARIA/Attr, dann Style/Geometrie).
 */
export async function waitTopicVisibility(page: Page, visible: boolean, timeout = 10_000): Promise<void> {
  const start = Date.now();
  const sel = await findTopicRowSelector(page);
  if (!sel) throw new Error('Topic row element not found via known selectors');

  const present = await page.locator(sel).count().catch(() => 0);
  // eslint-disable-next-line no-console
  console.log(`[e2e:topic] using selector: "${sel}" (count=${present}) → wait ${visible ? 'visible' : 'hidden'}`);

  // 1) Attribute/ARIA
  try {
    await page.waitForFunction(
      ({ s, v }) => {
        const el = document.querySelector<HTMLElement>(s);
        if (!el) return false;

        const ariaHidden = el.getAttribute('aria-hidden');
        const dataVisible = el.getAttribute('data-visible');
        const hiddenAttr = el.hasAttribute('hidden') || (el as any).hidden === true;

        const isHiddenAttr =
          hiddenAttr || ariaHidden === 'true' || dataVisible === 'false' || el.getAttribute('inert') !== null;
        const isVisibleAttr = ariaHidden === 'false' || dataVisible === 'true';

        return v ? (isVisibleAttr || !isHiddenAttr) : isHiddenAttr;
      },
      { s: sel, v: visible },
      { timeout: Math.min(timeout, 6000) }
    );
    return;
  } catch {
    // Fallback unten
  }

  // 2) Computed Style + Geometrie
  const remaining = Math.max(500, timeout - (Date.now() - start));
  await page.waitForFunction(
    ({ s, v }) => {
      const el = document.querySelector<HTMLElement>(s);
      if (!el) return false;
      const cs = getComputedStyle(el);
      const cssVisible = cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
      const hasSize = el.offsetWidth > 0 && el.offsetHeight > 0 && el.getBoundingClientRect().height > 0;
      const actuallyVisible = cssVisible && hasSize;
      return v ? actuallyVisible : !actuallyVisible;
    },
    { s: sel, v: visible },
    { timeout: remaining }
  );
}

/**
 * Setzt den Menü-Toggle "Topic" in den gewünschten Zustand (true/false).
 * Öffnet das Menü bei Bedarf automatisch und klickt Input ODER zugehöriges <label for="…">.
 * Gibt true zurück, wenn ein Toggle gefunden wurde.
 */
export async function forceTopicToggle(page: Page, on: boolean): Promise<boolean> {
  // Sicherstellen, dass Menü offen ist
  let openedByUs = false;
  const overlay = page.locator('#appMenuOverlay, [data-test="menu-overlay"]');
  if (!(await overlay.isVisible().catch(() => false))) {
    openedByUs = await ensureMenuOpen(page);
  }

  const toggles = ['#menuTopicToggle', '[data-test="menu-topic-toggle"]', 'input[name="menu-topic"]'];
  for (const sel of toggles) {
    const loc = page.locator(sel).first();
    if (!(await loc.count())) continue;

    // Sichtbarkeit/Scrollen
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const visible = await loc.isVisible().catch(() => false);
    const before = await loc.isChecked().catch(() => undefined);

    if (before !== on) {
      if (visible) {
        await loc.click({ force: true });
      } else {
        // Fallback: zugehöriges Label klicken
        const id = await loc.getAttribute('id').catch(() => null);
        if (id) {
          const label = page.locator(`label[for="${id}"]`).first();
          if (await label.count()) {
            await label.click({ force: true });
          } else {
            // Ultimativ: programmatischer Click
            await loc.evaluate((el: any) => (el as HTMLInputElement).click());
          }
        } else {
          await loc.evaluate((el: any) => (el as HTMLInputElement).click());
        }
      }
      await page.waitForTimeout(120);
    }

    if (openedByUs) await ensureMenuClosed(page);
    return true;
  }

  if (openedByUs) await ensureMenuClosed(page);
  return false;
}
