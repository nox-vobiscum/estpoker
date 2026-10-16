import { test, expect, type Page } from '@playwright/test';
import { newRoomCode, roomUrlFor } from './utils/env';

// Baseline before the shared section was introduced.
const baselineCss = ':root #liveParticipantList{border:1px solid var(--ui-surface-border);border-radius:var(--ui-panel-radius);background:var(--ui-surface);box-shadow:var(--ui-shadow-sm)}';

async function geometry(page: Page) {
  return page.locator('#liveParticipantList .participant-row').evaluateAll(rows => rows.map(row => {
    const rect = row.getBoundingClientRect();
    const chip = row.querySelector('.row-right .mini-chip,.row-right .vote-chip')!.getBoundingClientRect();
    return { x: rect.x, width: rect.width, height: rect.height, chipCenter: chip.x + chip.width / 2 };
  }));
}

test('shared participant framing preserves row geometry and accessible menus', async ({ browser }) => {
  test.setTimeout(90_000);
  const contexts = await Promise.all(Array.from({ length: 5 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const host = pages[0]!;
  const code = newRoomCode('FRAME');
  try {
    await host.goto(roomUrlFor('Host', code));
    await expect(host.locator('body')).toHaveClass(/is-host/);
    for (let count = 1; count <= 5; count++) {
      if (count > 1) await pages[count - 1]!.goto(roomUrlFor(`Guest${count}`, code));
      await expect(host.locator('#liveParticipantList .participant-row')).toHaveCount(count);
      if (![1, 2, 5].includes(count)) continue;
      for (const width of [375, 393, 1280]) {
        await host.setViewportSize({ width, height: 852 });
        for (const theme of ['light', 'dark']) {
          await host.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
          const current = await geometry(host);
          await expect(host.locator('.participant-section .participant-heading')).toBeVisible();
          await expect(host.locator('.participant-section')).toHaveCSS('overflow', 'visible');
          const oldStyle = await host.addStyleTag({ content: baselineCss });
          await host.evaluate(() => {
            const section = document.querySelector('.participant-section')!;
            section.replaceWith(...Array.from(section.childNodes));
          });
          const baseline = await geometry(host);
          expect(current).toEqual(baseline);
          await oldStyle.evaluate(style => style.parentNode!.removeChild(style));
          await host.evaluate(() => {
            const heading = document.querySelector('.participant-heading')!;
            const list = document.querySelector('#liveParticipantList')!;
            const section = document.createElement('section');
            section.className = 'participant-section';
            section.setAttribute('aria-labelledby', 'participantHeading');
            heading.before(section);
            section.append(heading, list);
          });
          expect(await host.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        }
      }
    }
    const guestRow = host.locator('.participant-row').filter({ hasText: 'Guest2' });
    await guestRow.locator('.participant-more').click();
    await host.getByRole('menuitem', { name: 'Make spectator', exact: true }).click();
    await expect(guestRow).toHaveClass(/spectator/);
    await contexts[2]!.close();
    await expect(host.locator('.participant-row').filter({ hasText: 'Guest3' })).toHaveClass(/disconnected/);

    for (const width of [375, 393, 1280]) {
      await host.setViewportSize({ width, height: 852 });
      for (const last of [false, true]) {
        const triggers = host.locator('.participant-more');
        await (last ? triggers.last() : triggers.first()).click();
        const menu = host.getByRole('menu');
        await expect(menu).toBeVisible();
        for (const item of await menu.getByRole('menuitem').all()) await item.click({ trial: true });
        expect(await menu.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
        })).toBe(true);
        await host.keyboard.press('Escape');
      }
    }
  } finally { await Promise.all(contexts.map(context => context.close().catch(() => {}))); }
});
