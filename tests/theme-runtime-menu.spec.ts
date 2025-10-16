import { test, expect } from '@playwright/test';

test('Theme switch in Menu updates :root data-theme and reflects state', async ({ page }) => {
  await page.goto('/');

  // Open the app menu
  const menuBtn = page.locator('.menu-button');
  await expect(menuBtn).toBeVisible();
  await menuBtn.click();

  const bLight  = page.locator('#themeLight');
  const bDark   = page.locator('#themeDark');
  const bSystem = page.locator('#themeSystem');

  // At least one should be visible; in practice all three are.
  await expect(bLight).toBeVisible();
  await expect(bDark).toBeVisible();
  await expect(bSystem).toBeVisible();

  // Switch to Dark
  await bDark.click();
  await expect
    .poll(async () => (await page.evaluate(() => document.documentElement.getAttribute('data-theme') || '')))
    .toBe('dark');
  await expect(bDark).toHaveAttribute('aria-pressed', 'true');
  await expect(bLight).toHaveAttribute('aria-pressed', 'false');
  await expect(bSystem).toHaveAttribute('aria-pressed', 'false');

  // Switch to Light
  await bLight.click();
  await expect
    .poll(async () => (await page.evaluate(() => document.documentElement.getAttribute('data-theme') || '')))
    .toBe('light');
  await expect(bLight).toHaveAttribute('aria-pressed', 'true');
  await expect(bDark).toHaveAttribute('aria-pressed', 'false');
  await expect(bSystem).toHaveAttribute('aria-pressed', 'false');

  // Switch to System (removes the data-theme attribute)
  await bSystem.click();
  await expect
    .poll(async () => (await page.evaluate(() => document.documentElement.hasAttribute('data-theme'))))
    .toBe(false);
  await expect(bSystem).toHaveAttribute('aria-pressed', 'true');
  await expect(bLight).toHaveAttribute('aria-pressed', 'false');
  await expect(bDark).toHaveAttribute('aria-pressed', 'false');
});
