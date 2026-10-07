import { test, expect } from '@playwright/test';

for (const width of [375, 768, 1280]) {
  for (const theme of ['dark', 'light', 'system']) {
    for (const style of ['dev', 'clean']) {
      test(`${style}/${theme} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
        await page.addInitScript(({ style, theme }) => {
          localStorage.setItem('ep-ui-style', style);
          localStorage.setItem('estpoker-theme', theme);
        }, { style, theme });
        const roomCode = `style-${style}-${theme}-${width}-${Date.now()}`;
        for (const path of ['/?lang=en', '/about?lang=en', `/room?roomCode=${roomCode}&participantName=Tester`]) {
          await page.goto(path);
          await expect(page.locator('html')).toHaveAttribute('data-ui-style', style);
          expect(await page.locator('html').getAttribute('data-theme')).toBe(theme === 'system' ? null : theme);
          expect(await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily))
            .toContain(style === 'dev' ? 'Consolas' : 'system-ui');
          await expect(page.locator('body')).toHaveCSS('background-color',
            theme === 'dark' ? 'rgb(30, 30, 30)' : 'rgb(246, 247, 249)');
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          if (path.startsWith('/about')) {
            await expect(page.locator('.about-section h2').first()).toHaveCSS('color',
              theme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(17, 24, 39)');
          }
          await page.locator('#menuButton').click();
          await expect(page.locator(style === 'dev' ? '#uiStyleDev' : '#uiStyleClean')).toHaveAttribute('aria-pressed', 'true');
          await expect(page.locator('#uiStyleDev')).toBeVisible();
          await expect(page.locator('#uiStyleClean')).toBeVisible();
          await page.locator('#menuButton').click();
        }
        if (theme === 'system') {
          await page.emulateMedia({ colorScheme: 'dark' });
          await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(30, 30, 30)');
          await expect(page.locator('html')).toHaveAttribute('data-ui-style', style);
        }
      });
    }
  }
}

test('keyboard style switching preserves theme, language and navigation state', async ({ page }) => {
  await page.goto('/?lang=en');
  await page.evaluate(() => { (window as any).__styleNavigationMarker = true; });
  await page.locator('#menuButton').click();
  await page.locator('#themeLight').click();
  await page.locator('#uiStyleClean').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-ui-style', 'clean');
  await expect(page.locator('#uiStyleDev')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#uiStyleClean')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => (window as any).__styleNavigationMarker)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('ep-ui-style'))).toBe('clean');
  await page.locator('#menuButton').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ui-style', 'clean');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#hcLangDE').click();
  await page.locator('#menuButton').click();
  await expect(page.locator('#uiStyleDev')).toHaveAttribute('title', 'Oberflächenstil: Dev');
  await expect(page.locator('#uiStyleClean')).toHaveAttribute('aria-label', 'Oberflächenstil: Clean');
  await page.locator('#uiStyleDev').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-ui-style', 'dev');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#menuButton').click();
  await page.locator('#hcLangEN').click();
  await page.locator('#menuButton').click();
  await expect(page.locator('#uiStyleClean')).toHaveAttribute('title', 'Interface style: Clean');
});

for (const stored of [null, 'invalid', 'clean']) {
  test(`style is applied before CSS loads: ${stored}`, async ({ page }) => {
    await page.addInitScript(value => {
      if (value !== null) localStorage.setItem('ep-ui-style', value);
    }, stored);
    let earlyStyle: string | null = null;
    await page.route('**/styles.css?*', async route => {
      earlyStyle = await page.evaluate(() => document.documentElement.getAttribute('data-ui-style'));
      await route.continue();
    });
    await page.goto('/');
    expect(earlyStyle).toBe(stored === 'clean' ? 'clean' : 'dev');
    await expect(page.locator('html')).toHaveAttribute('data-ui-style', stored === 'clean' ? 'clean' : 'dev');
  });
}

test('blocked storage still gives an early Dev fallback', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
    Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-ui-style', 'dev');
  await page.locator('#menuButton').click();
  await page.locator('#uiStyleClean').click();
  await expect(page.locator('html')).toHaveAttribute('data-ui-style', 'clean');
});

for (const style of ['dev', 'clean']) {
  test(`vote, reveal and reset remain functional in ${style}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext();
    await context.addInitScript(value => localStorage.setItem('ep-ui-style', value), style);
    const host = await context.newPage();
    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    const room = `style-${style}-${Date.now()}`;
    let state: any;
    host.on('websocket', socket => socket.on('framereceived', event => {
      try {
        const data = JSON.parse(String(event.payload));
        if (data.type === 'voteUpdate') state = data;
      } catch {}
    }));
    try {
      await host.goto(`${testInfo.project.use.baseURL}/room?roomCode=${room}&participantName=Host`);
      await expect.poll(() => state?.participants?.length).toBe(1);
      await guest.goto(`${testInfo.project.use.baseURL}/room?roomCode=${room}&participantName=Guest`);
      await expect.poll(() => state?.participants?.length).toBe(2);
      await host.locator('#cardGrid button').filter({ hasText: /^5$/ }).click();
      await guest.locator('#cardGrid button').filter({ hasText: /^3$/ }).click();
      await expect.poll(() => state?.participants?.filter((p: any) => p.vote != null).length).toBe(2);
      await host.locator('#revealButton').click();
      await expect.poll(() => state?.votesRevealed).toBe(true);
      await expect(host.locator('#resetButton')).toBeVisible();
      await expect(host.locator('#averageVote')).toHaveText(/^4([.,]0+)?$/);
      await host.screenshot({ path: testInfo.outputPath(`${style}-room.png`), fullPage: true });
      await host.locator('#resetButton').click();
      await expect.poll(() => state?.votesRevealed).toBe(false);
      await expect.poll(() => state?.participants?.filter((p: any) => p.vote != null).length).toBe(0);
    } finally {
      await context.close();
      await guestContext.close();
    }
  });
}
