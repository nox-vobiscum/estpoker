// tests/utils/topic.ts
import type { Page } from '@playwright/test';
import { ensureMenuOpen, ensureMenuClosed } from './helpers';

export async function waitTopicVisibility(page: Page, visible: boolean, timeout = 3000) {
  const row = page.locator('[data-test="topic-row"], #topicRow');
  if (visible) {
    await row.waitFor({ state: 'visible', timeout }).catch(() => {});
  } else {
    // Hidden = either detached or present but CSS-hidden
    await page
      .waitForFunction(
        () => {
          const el =
            (document.querySelector('[data-test="topic-row"]') ||
              document.querySelector('#topicRow')) as HTMLElement | null;
          return !el || el.offsetParent === null || getComputedStyle(el).display === 'none';
        },
        { timeout }
      )
      .catch(() => {});
  }
}

export async function forceTopicToggle(page: Page, show: boolean) {
  await ensureMenuOpen(page);
  // Expect a single toggle; if there are two buttons (show/hide), click the one needed.
  const toggle = page.locator('[data-test="menu-topic-toggle"]').first();
  if (await toggle.count()) {
    await toggle.click().catch(() => {});
  } else {
    // fallback: two explicit actions (if present)
    const on  = page.locator('[data-test="menu-topic-on"]');
    const off = page.locator('[data-test="menu-topic-off"]');
    if (show && (await on.count())) await on.click().catch(() => {});
    if (!show && (await off.count())) await off.click().catch(() => {});
  }
  await ensureMenuClosed(page);
}
