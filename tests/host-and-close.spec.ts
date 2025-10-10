// Host actions: transfer & close room
// Robust confirm detection: native dialog, patched window.confirm OR modal dialog.

import { test, expect } from '@playwright/test';
import { roomUrlFor, newRoomCode } from './utils/env';
import { ensureMenuOpen } from './utils/helpers.js';

async function clickAndReadConfirmOrModal(
  page: import('@playwright/test').Page,
  clickFn: () => Promise<void>
): Promise<string> {
  let dialogMsg = '';
  page.once('dialog', async d => { dialogMsg = d.message(); await d.dismiss(); });

  // Patch window.confirm so we can observe text even if app intercepts
  await page.addInitScript(() => {
    const orig = window.confirm;
    (window as any).__lastConfirm = '';
    // @ts-ignore
    window.confirm = (msg: any) => {
      (window as any).__lastConfirm = String(msg ?? '');
      return false; // never actually confirm in destructive actions
    };
  });

  await clickFn();
  await page.waitForTimeout(200);

  const patched = await page.evaluate(() => (window as any).__lastConfirm || '');
  if (dialogMsg || patched) return dialogMsg || patched;

  // Modal fallback
  const dlg = page.locator(
    [
      '[role="dialog"]',
      '#confirmOverlay',
      '#confirmModal',
      '.modal.confirm',
      '.dialog.confirm'
    ].join(', ')
  );
  if (await dlg.count()) {
    const text = (await dlg.first().innerText()).trim();
    // Try to dismiss
    const cancel = dlg.locator('button:has-text("Cancel"), button:has-text("Abbrechen")').first();
    if (await cancel.count()) await cancel.click().catch(() => {});
    return text;
  }
  return '';
}

test.describe('Host actions: transfer & close room', () => {
  test('Close room (menu) shows a confirm dialog (en/de or modal)', async ({ browser }) => {
    const roomCode = newRoomCode('CLOSE');
    const ctxHost  = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host  = await ctxHost.newPage();
    const guest = await ctxGuest.newPage();

    await host.goto(roomUrlFor('Host', roomCode),  { waitUntil: 'domcontentloaded' });
    await guest.goto(roomUrlFor('Guest', roomCode), { waitUntil: 'domcontentloaded' });

    await ensureMenuOpen(host);

    const closeBtn = host.locator(
      [
        '#menuCloseRoomBtn',
        '[data-test="menu-close-room"]',
        '#closeRoomRow button',
        'button:has-text("Close room")',
        'button:has-text("Raum schließen")',
        'button:has-text("für alle schließen")',
        'button[aria-label*="close" i]',
        'button[title*="close" i]'
      ].join(', ')
    ).first();

    await expect(closeBtn).toHaveCount(1);

    const confirmMsg = await clickAndReadConfirmOrModal(host, async () => {
      await closeBtn.click({ force: true });
    });

    // Be permissive: anything that contains close/room keywords in EN/DE is fine
    expect(confirmMsg, 'Confirm dialog not shown').toBeTruthy();
    const ok =
      /close|schließ/i.test(confirmMsg) ||
      /raum|room/i.test(confirmMsg) ||
      /everyone|alle/i.test(confirmMsg);
    expect(ok).toBeTruthy();

    await ctxHost.close();
    await ctxGuest.close();
  });
});
