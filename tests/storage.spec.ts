import { test, expect } from '@playwright/test';

test('current settings are applied when CSS loads and survive reload', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('planningpoker-theme', 'light');
    localStorage.setItem('pp-ui-style', 'clean');
    localStorage.setItem('pp-name', 'Tester');
    localStorage.setItem('pp-room', 'current-team');
    // Observe bootstrap state when CSS loads without blocking the preload scanner.
    document.addEventListener('load', event => {
      if (event.target instanceof HTMLLinkElement && event.target.rel === 'stylesheet') {
        (window as any).__settingsAtStylesheet = {
          theme: document.documentElement.getAttribute('data-theme'),
          style: document.documentElement.getAttribute('data-ui-style'),
        };
      }
    }, true);
  });
  await page.goto('/');
  expect(await page.evaluate(() => (window as any).__settingsAtStylesheet)).toEqual({ theme: 'light', style: 'clean' });
  await expect(page.locator('#nameInput')).toHaveValue('Tester');
  await expect(page.locator('#roomInput')).toHaveValue('current-team');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ui-style', 'clean');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('invalid stored settings use defaults and unavailable storage is tolerated', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('planningpoker-theme', 'invalid');
    localStorage.setItem('pp-ui-style', 'invalid');
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-ui-style', 'dev');
  // The existing menu normalizes missing/invalid preferences to system mode.
  await expect.poll(() => page.evaluate(() => (window as any).PPStorage.theme())).toBe('system');
  expect(await page.evaluate(() => {
    localStorage.setItem('planningpoker-theme', 'invalid');
    return (window as any).PPStorage.theme();
  })).toBeNull();
  expect(await page.evaluate(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
    return (window as any).PPStorage.read('localStorage', 'pp-name');
  })).toBeNull();
});

test('CID and preflight marker survive joining and reload', async ({ page }) => {
  const room = `storage-${Date.now()}`;
  await page.addInitScript(room => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    sessionStorage.setItem('pp-cid', 'current-client-id');
    sessionStorage.setItem(`pp-pf-ok:${room}:Storage User`, '1');
  }, room);
  const preflightRequests: string[] = [];
  page.on('request', req => { if (req.url().includes('name-available')) preflightRequests.push(req.url()); });
  await page.goto(`/room?roomCode=${room}&participantName=Storage%20User`);
  await expect(page.locator('#cardGrid button').first()).toBeVisible();
  expect(preflightRequests).toEqual([]);
  await page.reload();
  await expect(page.locator('#cardGrid button').first()).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('pp-cid'))).toBe('current-client-id');
  expect(await page.evaluate(room => sessionStorage.getItem(`pp-pf-ok:${room}:Storage User`), room)).toBe('1');
});

for (const flag of ['kicked', 'roomClosed']) {
  test(`${flag} flash is consumed exactly once`, async ({ page }) => {
    await page.addInitScript(flag => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      sessionStorage.setItem('pp-flash', flag);
    }, flag);
    await page.goto('/?lang=en');
    await expect(page.locator('.toast')).toContainText(flag === 'kicked' ? 'leave' : 'closed');
    expect(await page.evaluate(() => sessionStorage.getItem('pp-flash'))).toBeNull();
    await page.reload();
    await expect(page.locator('.toast')).toHaveCount(0);
  });
}
