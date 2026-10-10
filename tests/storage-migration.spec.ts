import { test, expect } from '@playwright/test';

for (const key of ['estpoker-theme', 'ep-theme', 'theme', 'themeMode']) {
  test(`migrates ${key} before CSS and preserves rollback values`, async ({ page }) => {
    await page.addInitScript(key => {
      if (localStorage.getItem('seeded')) return;
      localStorage.setItem('seeded', '1');
      localStorage.setItem(key, 'light');
      localStorage.setItem('ep-ui-style', 'clean');
      localStorage.setItem('ep-name', 'Legacy tester');
      localStorage.setItem('ep-room', 'legacy-team');
    }, key);
    let early: { theme: string | null; style: string | null } | undefined;
    await page.route('**/styles.css*', async route => {
      // The preload scanner may request CSS before the preceding script executes.
      // Hold the response until bootstrap runs; no stylesheet can render yet.
      await page.waitForFunction(() => document.documentElement.hasAttribute('data-ui-style'));
      early = await page.evaluate(() => ({
        theme: document.documentElement.getAttribute('data-theme'),
        style: document.documentElement.getAttribute('data-ui-style'),
      }));
      await route.continue();
    });
    await page.goto('/');
    expect(early).toEqual({ theme: 'light', style: 'clean' });
    await expect(page.locator('#nameInput')).toHaveValue('Legacy tester');
    await expect(page.locator('#roomInput')).toHaveValue('legacy-team');
    await page.reload();
    expect(await page.evaluate(key => ({
      theme: localStorage.getItem('planningpoker-theme'),
      style: localStorage.getItem('pp-ui-style'),
      name: localStorage.getItem('pp-name'), room: localStorage.getItem('pp-room'),
      legacy: localStorage.getItem(key), legacyStyle: localStorage.getItem('ep-ui-style'),
      legacyName: localStorage.getItem('ep-name'), legacyRoom: localStorage.getItem('ep-room'),
    }), key)).toEqual({ theme: 'light', style: 'clean', name: 'Legacy tester', room: 'legacy-team',
      legacy: 'light', legacyStyle: 'clean', legacyName: 'Legacy tester', legacyRoom: 'legacy-team' });
  });
}

test('valid canonical settings win, invalid theme falls back in defined order', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('planningpoker-theme', 'system');
    localStorage.setItem('estpoker-theme', 'light');
    localStorage.setItem('ep-theme', 'dark');
    localStorage.setItem('pp-ui-style', 'dev');
    localStorage.setItem('ep-ui-style', 'clean');
    localStorage.setItem('pp-name', 'New name');
    localStorage.setItem('ep-name', 'Old name');
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-ui-style', 'dev');
  expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
  await expect(page.locator('#nameInput')).toHaveValue('New name');
  expect(await page.evaluate(() => {
    localStorage.setItem('planningpoker-theme', 'invalid');
    return (window as any).PPStorage.theme();
  })).toBe('light');
});

test('legacy CID and exact preflight suffix survive joining and reload', async ({ page }) => {
  const room = `migration-${Date.now()}`;
  await page.addInitScript(room => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    sessionStorage.setItem('ep-cid', 'legacy-client-id');
    sessionStorage.setItem(`ep-pf-ok:${room}:Legacy User`, '1');
  }, room);
  const preflightRequests: string[] = [];
  page.on('request', req => { if (req.url().includes('name-available')) preflightRequests.push(req.url()); });
  await page.goto(`/room?roomCode=${room}&participantName=Legacy%20User`);
  await expect(page.locator('#cardGrid button').first()).toBeVisible();
  expect(await page.evaluate(room => ({
    cid: sessionStorage.getItem('pp-cid'), legacy: sessionStorage.getItem('ep-cid'),
    preflight: sessionStorage.getItem(`pp-pf-ok:${room}:Legacy User`),
    legacyPreflight: sessionStorage.getItem(`ep-pf-ok:${room}:Legacy User`),
  }), room)).toEqual({ cid: 'legacy-client-id', legacy: 'legacy-client-id', preflight: '1', legacyPreflight: '1' });
  expect(preflightRequests).toEqual([]);
  await page.reload();
  await expect(page.locator('#cardGrid button').first()).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('pp-cid'))).toBe('legacy-client-id');
});

for (const flag of ['kicked', 'roomClosed']) {
  test(`legacy ${flag} flash is consumed exactly once`, async ({ page }) => {
    await page.addInitScript(flag => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      sessionStorage.setItem('ep-flash', flag);
    }, flag);
    await page.goto('/?lang=en');
    await expect(page.locator('.toast')).toContainText(flag === 'kicked' ? 'leave' : 'closed');
    expect(await page.evaluate(() => [sessionStorage.getItem('ep-flash'), sessionStorage.getItem('pp-flash')])).toEqual([null, null]);
    await page.reload();
    await expect(page.locator('.toast')).toHaveCount(0);
  });
}

