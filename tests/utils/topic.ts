import type { Page } from '@playwright/test';

// Wait until #topicRow visibility matches the expected state.
// Primary signal: data-visible (set by the app). Fallback: CSS/layout.
export async function waitTopicVisibility(page: Page, visible: boolean, timeout = 10_000) {
  await page.waitForFunction(
    (exp) => {
      const el = document.querySelector<HTMLElement>('#topicRow');
      if (!el) return false;

      const ds = el.getAttribute('data-visible');
      if (ds === (exp ? '1' : '0')) return true;

      const cs = getComputedStyle(el);
      const shown = cs.display !== 'none'
        && cs.visibility !== 'hidden'
        && Number(cs.opacity) > 0
        && el.offsetWidth > 0
        && el.offsetHeight > 0;

      return exp ? shown : !shown;
    },
    visible,
    { timeout }
  );
}
