import { test, expect } from '@playwright/test';

const loaderSelector = 'script[src="https://www.googletagmanager.com/gtag/js?id=G-8Q9XZ0H39G"]';

test('Google Analytics is configured once on public content pages', async ({ page }) => {
  for (const path of ['/', '/about', '/imprint']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator(loaderSelector)).toHaveCount(1);
    await expect(page.locator(loaderSelector)).toHaveAttribute('async', '');
    const configCount = await page.locator('head script:not([src])').evaluateAll(scripts =>
      scripts.filter(script => script.textContent?.includes("gtag('config', 'G-8Q9XZ0H39G')")).length);
    expect(configCount).toBe(1);
  }
});

test('room and invitation URLs are not exposed to Google Analytics', async ({ page }) => {
  for (const path of ['/invite?roomCode=private-room', '/room?roomCode=private-room&participantName=Private']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator(loaderSelector)).toHaveCount(0);
  }
});
