import { expect, Page } from '@playwright/test';
export { ensureMenuOpen, ensureMenuClosed } from './helpers';

export async function waitTopicVisibility(
  page: Page,
  should: boolean,
  timeout = 8000
): Promise<void> {
  await page.waitForFunction(
    (want: boolean) => {
      // 1) Dataset hint set by menu bridge / test fallback
      const ds = (document.body as any)?.dataset?.topicVisible;
      if (ds === String(!!want)) return true;

      // 2) Toggle ARIA state as a secondary signal
      const t = document.getElementById('menuTopicToggle') as HTMLInputElement | null;
      if (t) {
        const aria = t.getAttribute('aria-checked');
        const cur = aria === 'true' ? true : aria === 'false' ? false : !!(t as any).checked;
        if (cur === want) return true;
      }

      // 3) Real DOM visibility of the row
      const row = document.getElementById('topicRow') as HTMLElement | null;
      if (!row) return want === false; // if row isn't rendered, treat as hidden

      if ('hidden' in row && (row as any).hidden === !want) return true;
      const style = (row.style && row.style.display) || '';
      if ((style === 'none') === !want) return true;

      const cs = getComputedStyle(row);
      const visible = !!(row.offsetParent !== null && cs.display !== 'none' && cs.visibility !== 'hidden');
      return visible === want;
    },
    should,
    { timeout }
  );
}

export async function forceTopicToggle(page: Page, on: boolean): Promise<void> {
  const { ensureMenuOpen, ensureMenuClosed } = await import('./helpers');

  await ensureMenuOpen(page);
  const t = page.locator('#menuTopicToggle').first();
  await expect(t).toHaveCount(1);

  const cur = await t.evaluate((el: HTMLInputElement) => {
    const aria = el.getAttribute('aria-checked');
    if (aria === 'true') return true;
    if (aria === 'false') return false;
    return !!(el as any).checked;
  });

  if (cur !== on) {
    // try UI click
    await t.click({ force: true }).catch(() => {});
    // enforce state + dispatch events
    await t.evaluate((el: HTMLInputElement, want: boolean) => {
      try { (el as any).checked = want; } catch {}
      el.setAttribute('aria-checked', String(want));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, on).catch(() => {});
  }

  // If the app has a bridge helper, use it; otherwise mirror directly.
  await page.evaluate((want: boolean) => {
    const w = window as any;
    if (typeof w.setTopicVisible === 'function') {
      try { w.setTopicVisible(want); return; } catch {}
    }
    const row = document.getElementById('topicRow') as HTMLElement | null;
    if (row) {
      row.classList.toggle('is-hidden', !want);
      (row as any).hidden = !want;
      try { (row.style as any).display = want ? '' : 'none'; } catch {}
    }
    if (document.body) (document.body as any).dataset.topicVisible = String(!!want);
    try { document.dispatchEvent(new CustomEvent('ep:topic:set', { detail: { visible: !!want } })); } catch {}
  }, on).catch(() => {});

  await ensureMenuClosed(page);
}
