import { expect, test, type Page } from '@playwright/test';
import {
  ensureMenuClosed,
  ensureMenuOpen,
  newRoomCode,
  roomUrlFor,
  setSequenceViaEvent,
  waitAppReady,
} from './utils/helpers';

async function expectCenteredGrid(page: Page) {
  const geometry = await page.locator('#cardGrid').evaluate(grid => {
    const gridRect = grid.getBoundingClientRect();
    const buttons = Array.from(grid.querySelectorAll('button')).map(button => button.getBoundingClientRect());
    const firstTop = Math.min(...buttons.map(rect => rect.top));
    const firstRow = buttons.filter(rect => Math.abs(rect.top - firstTop) <= 1);
    const laterRows = [...new Set(buttons.filter(rect => rect.top > firstTop + 1).map(rect => Math.round(rect.top)))];
    const leftsByRow = [firstTop, ...laterRows].map(top =>
      buttons.filter(rect => Math.abs(rect.top - top) <= 1).map(rect => Math.round(rect.left))
    );
    const referenceRow = leftsByRow[0] || [];
    const firstLeft = Math.min(...firstRow.map(rect => rect.left));
    const firstRight = Math.max(...firstRow.map(rect => rect.right));
    return {
      centerDelta: Math.abs((firstLeft + firstRight) / 2 - (gridRect.left + gridRect.right) / 2),
      alignedRows: leftsByRow.every(row => row.every((left, index) => left === referenceRow[index])),
      lastRowStartsAtFirstAxis: leftsByRow.at(-1)?.[0] === referenceRow[0],
      overflow: document.documentElement.scrollWidth - innerWidth,
      cardWidths: [...new Set(buttons.map(rect => Math.round(rect.width * 10) / 10))],
    };
  });

  expect(geometry.centerDelta).toBeLessThanOrEqual(1);
  expect(geometry.alignedRows).toBe(true);
  expect(geometry.lastRowStartsAtFirstAxis).toBe(true);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.cardWidths).toHaveLength(1);
}

for (const width of [320, 375, 393, 430]) {
  test(`mobile voting tracks are centered at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.goto(roomUrlFor('Grid Host', newRoomCode('GRID')));
    await waitAppReady(page);

    await expectCenteredGrid(page);

    await setSequenceViaEvent(page, 'fib.enh');
    await expect(page.locator('#cardGrid button[data-value="100"]')).toBeVisible();
    await expectCenteredGrid(page);

    await setSequenceViaEvent(page, 'tshirt');
    await expect(page.locator('#cardGrid button[data-value="XXXL"]')).toBeVisible();
    await expectCenteredGrid(page);

    if (width === 393) {
      await ensureMenuOpen(page);
      const toggle = page.locator('#menuSpecialsToggle');
      if (!(await toggle.isChecked())) await toggle.click({ force: true });
      const coffee = page.locator('#rowSpecialsPick .spc[data-id="coffee"]');
      await expect(coffee).toBeVisible();
      if (await coffee.getAttribute('aria-pressed') !== 'true') await coffee.click({ force: true });
      await ensureMenuClosed(page);
      await expect(page.locator('#cardGrid button[data-value="☕"]')).toBeVisible();
      await expectCenteredGrid(page);
    }
  });
}

test('desktop voting grid keeps its existing intrinsic layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(roomUrlFor('Desktop Host', newRoomCode('GRID-DESKTOP')));
  await waitAppReady(page);
  await expect(page.locator('#cardGrid')).toHaveCSS('width', /\d+px/);
  expect(await page.locator('#cardGrid').evaluate(grid => grid.getBoundingClientRect().width)).toBeLessThan(800);
});
