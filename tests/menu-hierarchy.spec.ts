import { test, expect } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

for (const width of [320, 768, 1280]) {
  test(`room settings follow the same section and keyboard order at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 600 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(roomUrlFor('Host', newRoomCode('MR010')) + '&lang=en');
    await expect(page.locator('body')).toHaveClass(/is-host/);
    await page.locator('#menuButton').click();
    await expect(page.locator('#menuCloseButton')).toBeFocused();
    await expect(page.locator('#menuSequenceHeading .pp-status-icon use')).toHaveAttribute('href', '#pp-icon-host');
    await expect(page.locator('#menuRoomHeading .pp-status-icon use')).toHaveAttribute('href', '#pp-icon-host');
    await expect(page.locator('#rowParticipation .pp-status-icon use')).toHaveAttribute('href', '#pp-icon-person');

    const sectionIds = width <= 768
      ? ['menuLanguageHeading', 'menuThemeHeading', 'menuSequenceHeading', 'menuRoomHeading', 'menuPersonalHeading', 'menuSecondaryHeading']
      : ['menuSequenceHeading', 'menuRoomHeading', 'menuPersonalHeading', 'menuSecondaryHeading'];
    const headings = page.locator('.menu-panel .menu-section > .section-title:visible');
    await expect(headings).toHaveCount(sectionIds.length);
    expect(await headings.evaluateAll(els => els.map(el => el.id))).toEqual(sectionIds);
    for (const id of sectionIds) {
      const section = page.locator('.menu-section', { has: page.locator('#' + id) });
      await expect(section).toHaveAttribute('role', 'group');
      await expect(section).toHaveAttribute('aria-labelledby', id);
      await expect(section).toHaveAccessibleName(/.+/);
    }
    if (width > 768) {
      await expect(page.locator('#menuLanguageHeading')).toBeHidden();
      await expect(page.locator('#menuThemeHeading')).toBeHidden();
    }
    else {
      await expect(page.locator('#menuLanguageHeading')).toHaveText('Language');
      const preferenceGeometry = await page.locator('.menu-preferences > .menu-section').evaluateAll(sections =>
        sections.map(section => {
          const rect = section.getBoundingClientRect();
          return { left: rect.left, top: rect.top };
        }));
      expect(preferenceGeometry).toHaveLength(2);
      expect(Math.abs(preferenceGeometry[0]!.top - preferenceGeometry[1]!.top)).toBeLessThanOrEqual(1);
      expect(preferenceGeometry[1]!.left).toBeGreaterThan(preferenceGeometry[0]!.left);
      expect(await page.locator('.menu-preferences').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }

    const focusOrder: string[] = [];
    for (let i = 0; i < 35; i++) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => (document.activeElement as HTMLElement)?.id || '');
      if (id) focusOrder.push(id);
      if (id === 'closeRoomBtn') break;
    }
    const expected = width <= 768
      ? ['menuLangDE', 'themeLight', 'menuAutoRevealToggle', 'menuParticipationToggle', 'closeRoomBtn']
      : ['menuAutoRevealToggle', 'menuParticipationToggle', 'closeRoomBtn'];
    let previous = -1;
    for (const id of expected) {
      const index = focusOrder.indexOf(id);
      expect(index, `${id} is missing from keyboard navigation: ${focusOrder}`).toBeGreaterThan(previous);
      previous = index;
    }

    await page.locator('#menuSecondaryHeading').scrollIntoViewIfNeeded();
    await expect(page.locator('#closeRoomBtn')).toBeInViewport();
    expect(await page.locator('.menu-panel').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('menu-sections.png'), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(page.locator('#menuButton')).toBeFocused();
  });
}

test('public pages retain only their applicable settings sections', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 600 });
  for (const path of ['/', '/about']) {
    await page.goto(path + '?lang=de');
    if (path === '/') await expect(page.locator('.join-form .pp-status-icon use')).toHaveAttribute('href', '#pp-icon-person');
    await page.locator('#menuButton').click();
    await expect(page.locator('#menuLanguageHeading')).toHaveText('Sprache');
    await expect(page.locator('#menuPersonalHeading')).toHaveText('Persönliche Funktionen');
    await expect(page.locator('#menuSequenceHeading, #menuRoomHeading, #menuSecondaryHeading')).toHaveCount(0);
    await expect(page.locator('#menuParticipationToggle')).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

test('host and guest keep the same menu hierarchy and room permissions', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const room = newRoomCode('MR010');
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    await host.goto(roomUrlFor('Host', room));
    await expect(host.locator('body')).toHaveClass(/is-host/);
    await guest.goto(roomUrlFor('Guest', room));
    await expect(host.locator('#liveParticipantList .participant-row')).toHaveCount(2);
    for (const page of [host, guest]) {
      await page.locator('#menuButton').click();
      await expect(page.locator('#menuSequenceHeading')).toBeVisible();
      await expect(page.locator('#menuRoomHeading')).toBeVisible();
      await expect(page.locator('#menuPersonalHeading')).toBeVisible();
      await expect(page.locator('#menuSecondaryHeading')).toBeVisible();
      await expect(page.locator('#menuParticipationToggle')).toBeEnabled();
    }
    for (const id of ['menuAutoRevealToggle', 'menuTopicToggle', 'menuSpecialsToggle', 'menuHardModeToggle']) {
      await expect(host.locator('#' + id)).toBeEnabled();
      await expect(guest.locator('#' + id)).toBeDisabled();
    }
    await guest.locator('#menuParticipationToggle').scrollIntoViewIfNeeded();
    await expect(guest.locator('#menuParticipationToggle')).toBeInViewport();
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
