import { test, expect } from '@playwright/test';

function contrast(first: string, second: string): number {
  function luminance(color: string): number {
    const scale = color.startsWith('color(srgb ') ? 1 : 255;
    const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
      const normalized = value / scale;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  }
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

for (const style of ['dev', 'clean']) {
  for (const theme of ['light', 'dark', 'system']) {
    test(`about surfaces stay readable and bounded in ${style}/${theme}`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
      await page.addInitScript(({ style, theme }) => {
        localStorage.setItem('pp-ui-style', style);
        localStorage.setItem('planningpoker-theme', theme);
      }, { style, theme });
      for (const width of [375, 1280]) {
        await page.setViewportSize({ width, height: 700 });
        await page.goto('/about?lang=en');
        await expect(page.locator('html')).toHaveAttribute('data-ui-style', style);
        const sections = page.locator('.page-about .about-section');
        const count = await sections.count();
        expect(count).toBeGreaterThan(1);
        const surface = sections.first();
        if (style === 'clean') {
          const colors = await surface.evaluate(el => {
            const card = getComputedStyle(el), text = getComputedStyle(el.querySelector('p')!);
            return { background: card.backgroundColor, text: text.color, border: card.borderTopStyle };
          });
          const bodyBackground = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
          expect(colors.background).not.toBe(bodyBackground);
          expect(colors.border).toBe('solid');
          expect(contrast(colors.background, colors.text)).toBeGreaterThanOrEqual(4.5);
          await expect(page.locator('.page-about .about-intro')).toHaveCSS('background-image', /linear-gradient/);
          await expect(surface).toHaveCSS('animation-duration', '0s');
          await expect(surface).toHaveCSS('transition-duration', '0s');
        } else {
          await expect(surface).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
          await expect(surface).toHaveCSS('border-top-style', 'none');
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const intro = (await page.locator('.page-about .about-intro').boundingBox())!;
        const first = (await sections.first().boundingBox())!;
        const last = (await sections.last().boundingBox())!;
        expect(intro.y + intro.height).toBeLessThan(first.y);
        expect(first.y + first.height).toBeLessThan(last.y);
        await sections.last().scrollIntoViewIfNeeded();
        await expect(sections.last()).toBeInViewport();
        if (style === 'clean' && width === 375 && theme !== 'system') {
          await page.screenshot({ path: testInfo.outputPath(`${theme}-about.png`), fullPage: true, animations: 'disabled' });
        }
      }
      if (theme === 'system' && style === 'clean') {
        const before = await page.locator('.page-about .about-section').first().evaluate(el => getComputedStyle(el).backgroundColor);
        await page.emulateMedia({ colorScheme: 'dark' });
        const after = await page.locator('.page-about .about-section').first().evaluate(el => getComputedStyle(el).backgroundColor);
        expect(after).not.toBe(before);
        await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
      }
    });
  }
}
