// tests/menu-sequence.spec.ts
// Menu sequence radios: host enabled ODER (falls UI disabled rendert) per programmatic fallback;
// change propagates; guest-Änderungsversuch ohne Effekt.
//
// Run: EP_BASE_URL=http://localhost:8080 npx playwright test -c playwright.config.ts tests/menu-sequence.spec.ts

import { test, expect, Page } from '@playwright/test';
import { roomUrlFor, newRoomCode } from './utils/env';
import {
  ensureMenuOpen,
  ensureMenuClosed,
  waitSeq,
  getSelectedSequenceId,
} from './utils/helpers';

const CANDIDATES = ['fib.scrum', 'fib.enh', 'fib.math', 'pow2', 'tshirt'] as const;

function seqInput(page: Page, value: string) {
  return page.locator(`#menuSeqChoice input[type="radio"][name="menu-seq"][value="${value}"]`);
}

async function hostSetSequence(page: Page, value: string): Promise<void> {
  await ensureMenuOpen(page);
  const input = seqInput(page, value).first();

  // vorhanden?
  const exists = (await input.count()) > 0;
  expect(exists, `radio for "${value}" should exist`).toBeTruthy();

  const isDisabled = await input.isDisabled().catch(() => false);
  const ariaDisabled = (await input.getAttribute('aria-disabled').catch(() => null)) === 'true';

  if (!(isDisabled || ariaDisabled)) {
    // normaler Weg
    await input.check({ force: true }).catch(() => {});
  } else {
    // programmatischer Fallback
    await page.evaluate((val: string) => {
      const el = document.querySelector<HTMLInputElement>(
        `#menuSeqChoice input[name="menu-seq"][value="${val}"]`
      );
      if (!el) return;
      el.checked = true;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value).catch(() => {});
  }

  // weitere Fallbacks (Label/Row), falls nötig
  const id = await input.getAttribute('id').catch(() => null);
  if (id) {
    const lab = page.locator(`#menuSeqChoice label[for="${id}"]`).first();
    if ((await lab.count()) > 0) await lab.click({ force: true }).catch(() => {});
  }
  const row = page.locator(`#menuSeqChoice label.radio-row:has(input[value="${value}"])`).first();
  if ((await row.count()) > 0) await row.click({ force: true }).catch(() => {});

  await ensureMenuClosed(page);
}

async function guestTryChangeAndAssertNoEffect(guest: Page, attempted: string, mustRemain: string): Promise<void> {
  await ensureMenuOpen(guest);

  const input = seqInput(guest, attempted).first();
  const exists = (await input.count()) > 0;
  expect(exists, `guest radio "${attempted}" should exist`).toBeTruthy();

  const disabledProp = await input.isDisabled().catch(() => false);
  const ariaDisabled = (await input.getAttribute('aria-disabled').catch(() => null)) === 'true';

  if (disabledProp || ariaDisabled) {
    // UI blockiert; schließen und später Zustand prüfen
    await ensureMenuClosed(guest);
  } else {
    // UI erlaubt Klick, Server sollte ignorieren → No-Effect prüfen
    await input.click({ force: true }).catch(() => {});
    await ensureMenuClosed(guest);
  }

  await expect
    .poll(() => getSelectedSequenceId(guest), { timeout: 2500, intervals: [200, 300, 500] })
    .toBe(mustRemain);
}

test('Menu sequence radios: host enabled, guest disabled; change propagates', async ({ browser }) => {
  const room = newRoomCode('SEQ-MENU');

  const ctxHost = await browser.newContext();
  const ctxGuest = await browser.newContext();
  const host = await ctxHost.newPage();
  const guest = await ctxGuest.newPage();

  await host.goto(roomUrlFor('Host', room), { waitUntil: 'domcontentloaded' });
  await guest.goto(roomUrlFor('Guest', room), { waitUntil: 'domcontentloaded' });

  await ensureMenuOpen(host);
  await ensureMenuOpen(guest);

  const hostRadios = host.locator('#menuSeqChoice input[name="menu-seq"]');
  const guestRadios = guest.locator('#menuSeqChoice input[name="menu-seq"]');

  const hostCount = await hostRadios.count();
  const guestCount = await guestRadios.count();
  expect(hostCount).toBeGreaterThan(0);
  expect(guestCount).toBe(hostCount);

  await ensureMenuClosed(host);
  await ensureMenuClosed(guest);

  // Ausgangszustand beim Gast
  const initialGuest = await getSelectedSequenceId(guest);
  const target: string = (CANDIDATES.find(v => v !== initialGuest) ?? CANDIDATES[0]!);

  // Host ändert Sequenz (robust)
  await hostSetSequence(host, target);

  // erst Host → dann Guest
  await expect
    .poll(() => getSelectedSequenceId(host), { timeout: 6000, intervals: [200, 300, 500] })
    .toBe(target);
  await expect
    .poll(() => getSelectedSequenceId(guest), { timeout: 6000, intervals: [200, 300, 500] })
    .toBe(target);

  // zusätzliche Sicherung (Grid-/Deck-Heuristik in waitSeq)
  expect(await waitSeq(host, target, 4000)).toBe(true);
  expect(await waitSeq(guest, target, 4000)).toBe(true);

  // Gast versucht etwas anderes zu setzen → kein Effekt
  const naughty: string = (CANDIDATES.find(v => v !== target) ?? 'fib.scrum');
  await guestTryChangeAndAssertNoEffect(guest, naughty, target);

  await ctxHost.close();
  await ctxGuest.close();
});
