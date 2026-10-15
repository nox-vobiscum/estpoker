import { test, expect } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

for (const theme of ['light', 'dark']) {
  test(`${theme}: readable preferences, keyboard room flow and reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(({ theme }) => {
      localStorage.setItem('planningpoker-theme', theme);
      localStorage.setItem('lang', 'de');
    }, { theme });
    await page.goto('/');
    await expect(page.getByRole('main')).toHaveCount(1);
    const ratios = await page.locator('.preference-control button, .landing-cta, .landing-cta a, .join-form .button').evaluateAll(elements => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d')!;
      const paint = (color: string) => { ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); };
      const luminance = (data: Uint8ClampedArray) => {
        const values = [...data].slice(0, 3).map(c => { const v = c / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
        return values[0]! * .2126 + values[1]! * .7152 + values[2]! * .0722;
      };
      return elements.filter(el => el.getClientRects().length).map(el => {
        ctx.clearRect(0, 0, 1, 1); paint('white');
        const ancestors: Element[] = []; let node: Element | null = el;
        while (node) { ancestors.unshift(node); node = node.parentElement; }
        ancestors.forEach(node => paint(getComputedStyle(node).backgroundColor));
        const bg = luminance(ctx.getImageData(0, 0, 1, 1).data);
        paint(getComputedStyle(el).color);
        const fg = luminance(ctx.getImageData(0, 0, 1, 1).data);
        return (Math.max(bg, fg) + .05) / (Math.min(bg, fg) + .05);
      });
    });
    for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
    await page.locator('#nameInput').focus();
    await page.keyboard.type('Keyboard');
    await page.keyboard.press('Tab');
    await expect(page.locator('#roomInput')).toBeFocused();
    await page.keyboard.type(newRoomCode('A11Y'));
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveClass(/is-host/);
    const card = page.locator('#cardGrid button[data-value="3"]');
    await expect(card).toBeEnabled();
    await card.focus();
    await page.keyboard.press('Space');
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(card).toBeFocused();
    await expect(card).toHaveCSS('outline-style', 'solid');
    await page.locator('#revealButton').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#resultAnnounce')).toContainText(/Konsens|Durchschnitt/);
    await expect(page.locator('#resultAnnounce')).toHaveAttribute('role', 'status');
    await page.locator('#resetButton').focus();
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#menuButton').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#menuCloseButton')).toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('[role="group"][aria-checked]')).toHaveCount(0);
    await expect(page.locator('#menuSeqChoice')).toHaveAccessibleName(/Karten|Card/);
    const specials = page.locator('#menuSpecialsToggle');
    if (!await specials.isChecked()) {
      await specials.focus();
      await page.keyboard.press('Space');
    }
    await expect(page.locator('#rowSpecialsPick')).toBeVisible();
    await expect(page.locator('#rowSpecialsPick [data-id="coffee"]')).toHaveAccessibleName(/Pause|Kaffee/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#menuButton')).toBeFocused();
  });
}

test('mobile controls retain usable targets and reduced-motion results remain visible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(roomUrlFor('Host', newRoomCode('TARGET')));
  await expect(page.locator('body')).toHaveClass(/is-host/);
  await page.locator('#menuButton').click();
  for (const selector of ['#menuButton', '#menuCloseButton', '#menuParticipationToggle', '#themeLight']) {
    const box = await page.locator(selector).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);
  }
  await page.keyboard.press('Escape');
  await page.locator('#cardGrid button[data-value="3"]').click();
  await page.locator('#revealButton').click();
  const chip = page.locator('.vote-chip').first();
  await expect(chip).toBeVisible();
  await expect(chip).toHaveCSS('opacity', '1');
  await expect(chip).toHaveCSS('animation-name', 'none');
});
