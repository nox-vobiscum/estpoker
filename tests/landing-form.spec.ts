import { expect, test } from '@playwright/test';

test('landing form keeps validation, keyboard submission and accessible labels', async ({ page }) => {
  await page.goto('/?lang=en');
  const name = page.getByRole('textbox', { name: 'Your name' });
  const room = page.getByRole('textbox', { name: 'Room code' });
  const submit = page.locator('#joinForm button[type="submit"]');

  page.once('dialog', dialog => dialog.accept());
  await submit.click();
  await expect(name).toBeFocused();

  await name.fill('Form Tester');
  page.once('dialog', dialog => dialog.accept());
  await submit.click();
  await expect(room).toBeFocused();

  const code = `mr013-${Date.now()}`;
  await room.fill(code);
  await room.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/room\\?roomCode=${code}`));
});

test('landing and invite forms fit a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ['/', '/invite?roomCode=MR013']) {
    await page.goto(path);
    const form = page.locator('#joinForm');
    await expect(form).toBeVisible();
    const bounds = await form.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    await expect(form.locator('button[type="submit"]')).toBeVisible();
  }
});

test('home form has breathing room below the header', async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const header = (await page.locator('.app-header').boundingBox())!;
    const form = (await page.locator('#joinForm').boundingBox())!;
    expect(form.y - (header.y + header.height)).toBeGreaterThanOrEqual(width < 600 ? 32 : 48);
  }
});
