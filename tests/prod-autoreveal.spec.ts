// tests/prod-autoreveal.spec.js
// Prod: Auto-Reveal toggled → 3 numeric votes → room reveals automatically.
// Läuft nur, wenn PP_BASE_URL & PP_ROOM_URL gesetzt sind. Lokal sonst auto-skip.

import { test, expect, Page, Browser } from '@playwright/test';
import { roomUrlFor, ensureMenuOpen, ensureMenuClosed } from './_setup/prod-helpers.js';
import { baseUrl } from './utils/env';

const PP_BASE_URL = (process.env.PP_BASE_URL || process.env.EP_BASE_URL) || '';
const PP_ROOM_URL = (process.env.PP_ROOM_URL || process.env.EP_ROOM_URL) || '';

test.skip(!PP_BASE_URL || !PP_ROOM_URL, 'PP_BASE_URL / PP_ROOM_URL not set → skipping prod autoreveal test');

test('Prod: Auto-Reveal toggled → 3 votes → reveal auto', async ({ page }) => {
  // Frischer Raumcode für Isolation
  const room = `AR-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  // Seiten: Host + 2 Gäste
  const host = page;
  await host.goto(roomUrlFor('Host', room), { waitUntil: 'domcontentloaded' });

  const a = await host.context().newPage();
  await a.goto(roomUrlFor('A', room), { waitUntil: 'domcontentloaded' });

  const b = await host.context().newPage();
  await b.goto(roomUrlFor('B', room), { waitUntil: 'domcontentloaded' });

  // Grund-UI sichtbar
  await expect(host.locator('#cardGrid')).toBeVisible();
  await expect(a.locator('#cardGrid')).toBeVisible();
  await expect(b.locator('#cardGrid')).toBeVisible();

  // --- Host: Auto-Reveal einschalten (Toggle ist für alle sichtbar, nur Host änderbar)
  await ensureMenuOpen(host);
  const arToggle = host.locator('#menuAutoRevealToggle');
  await expect(arToggle, 'auto-reveal toggle should exist').toHaveCount(1);
  if (!(await arToggle.isChecked())) {
    await arToggle.check({ force: true });
  }
  await ensureMenuClosed(host);

  // --- Stimmen abgeben (nur numerische Karten, damit Auto-Reveal greift)
  async function vote(page, label) {
    const btn = page.getByRole('button', { name: String(label), exact: true });
    await expect(btn, `vote button "${label}" should exist`).toBeVisible();
    await btn.click();
  }
  await vote(host, 1);
  await vote(a, 3);
  await vote(b, 5);

  // --- Erwartung: Raum ist automatisch auf "revealed"
  // Robustes UI-Merkmal: .post-vote wird sichtbar (und .pre-vote verschwindet)
  await expect(host.locator('#resetButton')).toBeVisible({ timeout: 10_000 });
  await expect(host.locator('#revealButton')).toBeHidden({ timeout: 10_000 });

  // Sanity auf einem Gast
  for (const client of [host, a, b]) {
    await expect(client.locator('#averageVote')).toHaveText('3');
    await expect(client.locator('.vote-chip')).toHaveText(['1', '3', '5']);
  }

  // Cleanup
  await a.close();
  await b.close();
});
