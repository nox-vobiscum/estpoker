import { test, expect } from '@playwright/test';

for (const width of [375, 768, 769, 1280]) {
  test('settings lifecycle and scrolling at ' + width, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 600 });
    await page.goto('/room?roomCode=settings-' + width + '-' + Date.now() + '&participantName=Host');
    await expect(page.locator('body')).toHaveClass(/is-host/);
    await page.evaluate(() => {
      (window as any).__opens = 0;
      document.addEventListener('pp:menu-open', () => (window as any).__opens++);
    });
    const trigger = page.locator('#menuButton');
    const close = page.locator('#menuCloseButton');
    const panel = page.getByRole('dialog');
    await trigger.click();
    await expect(close).toBeFocused();
    await expect(panel).toHaveAccessibleName(/Settings|Einstellungen/);
    await expect(page.locator('.app-header')).toHaveAttribute('inert', '');
    await expect(page.locator('html')).toHaveClass(/menu-scroll-locked/);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(() => (window as any).__opens)).toBe(1);
    await panel.evaluate(async el => { await Promise.all(el.getAnimations().map(animation => animation.finished)); });
    // The inert header trigger must also paint behind the modal overlay.
    expect(await page.evaluate(() => {
      const trigger = document.querySelector('#menuButton')!;
      const rect = trigger.getBoundingClientRect();
      const painted = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return !!painted?.closest('#appMenuOverlay');
    })).toBe(true);
    const box = await panel.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.height).toBeLessThanOrEqual(600);
    if (width > 768) expect(box!.width).toBe(440);
    else expect(box!.width).toBe(width - 16);
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#closeRoomBtn')).toBeFocused();
    await expect(page.locator('#closeRoomBtn')).toBeInViewport();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.locator('#rowSpecialsPick .spc').first().focus();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator('.app-header')).not.toHaveAttribute('inert', '');
    await expect(page.locator('html')).not.toHaveClass(/menu-scroll-locked/);
    await trigger.click();
    await page.setViewportSize({ width: width <= 768 ? 1280 : 375, height: 600 });
    await expect(close).toBeFocused();
    expect(await page.evaluate(() => (window as any).__opens)).toBe(2);
    await page.screenshot({ path: testInfo.outputPath('settings.png') });
    await close.click();
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.locator('.menu-backdrop').click({ position: { x: 2, y: 2 } });
    await expect(panel).toBeHidden();
    expect(await page.evaluate(() => (window as any).__opens)).toBe(3);
  });
}

test('settings restores existing locks and page scroll', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    document.querySelector('footer')!.setAttribute('inert', '');
    document.documentElement.classList.add('menu-scroll-locked');
  });
  await page.locator('#menuButton').click();
  await page.locator('#menuCloseButton').click();
  await expect(page.locator('footer')).toHaveAttribute('inert', '');
  await expect(page.locator('html')).toHaveClass(/menu-scroll-locked/);
  await page.evaluate(() => document.documentElement.classList.remove('menu-scroll-locked'));
  await page.locator('#menuButton').focus();
  const before = await page.evaluate(() => scrollY);
  await page.keyboard.press('Enter');
  await page.mouse.wheel(0, 800);
  expect(await page.evaluate(() => scrollY)).toBe(before);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => scrollY)).toBe(before);
});

test('settings respects reduced motion and retains a focus fallback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#menuButton').click();
  const panel = page.getByRole('dialog');
  await expect(panel).toHaveCSS('animation-name', 'none');
  await panel.evaluate(el => el.querySelectorAll('button,input,a,select,textarea').forEach(node => {
    (node as HTMLElement).setAttribute('tabindex', '-1');
  }));
  await page.keyboard.press('Tab');
  await expect(panel).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menuButton')).toBeFocused();
});