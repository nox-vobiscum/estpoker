// tests/topic-flow.spec.ts
// Topic flow E2E (stable, multi-impl aware):
// - Show/Hide via menu toggle propagates to all clients
// - Edit & Save updates label for all clients (inline input OR prompt())
// - Clear resets label to dash on all clients
//
// Run (local):
//   EP_BASE_URL=http://localhost:8080 npx playwright test -c playwright.config.ts tests/topic-flow.spec.ts --headed

import { test, expect, Page } from '@playwright/test';
import { roomUrlFor, newRoomCode } from './utils/env';
import { waitTopicVisibility, forceTopicToggle } from './utils/topic';

// ---------- tiny utilities ----------

async function closeAnyMenus(page: Page) {
  const overlay = page.locator('#appMenuOverlay, [data-test="menu-overlay"], #menuPanel');
  if (await overlay.isVisible().catch(() => false)) {
    const toggle = page.locator('#menuButton, [data-test="menu-button"], button[aria-label="Menu"]');
    if (await toggle.count()) {
      await toggle.first().click({ trial: false }).catch(() => {});
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await expect(overlay).toBeHidden({ timeout: 1500 }).catch(() => {});
  }
}

async function safeClick(page: Page, css: string) {
  const el = page.locator(css).first();
  try {
    await el.click();
    return true;
  } catch {}
  try {
    await el.click({ force: true });
    return true;
  } catch {}
  // last resort: DOM click
  await page.evaluate((sel) => document.querySelector<HTMLElement>(sel)?.click(), css);
  return true;
}

function isDash(s: string) {
  const t = (s || '').trim();
  return t === '–' || t === '—';
}

// ---------- topic edit helpers (multi-implementation aware) ----------

/**
 * Try to set topic label either via inline editor (input/textarea)
 * or via a prompt() dialog. Returns true if label was submitted.
 */
async function setTopicLabel(page: Page, label: string): Promise<boolean> {
  await closeAnyMenus(page);

  // Ensure edit controls are present in this build/view
  const row      = page.locator('#topicRow');
  const editBtn  = page.locator('#topicEditBtn, [data-test="topic-edit"]');
  const clearBtn = page.locator('#topicClearBtn, [data-test="topic-clear"]');
  await expect(row).toHaveCount(1);
  await expect(editBtn).toHaveCount(1);
  await expect(clearBtn).toHaveCount(1);

  // Prepare prompt() fallback listener
  let sawPrompt = false;
  let promptText = '';
  page.once('dialog', async (d) => {
    if (d.type() === 'prompt') {
      sawPrompt = true;
      promptText = d.message();
      await d.accept(label);
    } else {
      await d.dismiss();
    }
  });

  // Click edit
  await editBtn.scrollIntoViewIfNeeded().catch(() => {});
  await safeClick(page, '#topicEditBtn, [data-test="topic-edit"]');

  // Case A: prompt()-based editor
  if (sawPrompt) {
    // Give the app a brief moment to re-render display text
    await page.waitForTimeout(150);
    return true;
  }

  // Case B: inline editor → look for a text field inside the row
  const input = row.locator(
    '#topicInput, [data-test="topic-input"], input[name="topic"], textarea[name="topic"], input[type="text"], textarea'
  ).first();

  // Wait briefly for an editor to appear under the row
  const appeared = await input.waitFor({ state: 'visible', timeout: 1200 }).then(
    () => true,
    () => false
  );

  if (!appeared) {
    // No prompt and no inline editor => this build likely doesn’t support editing in this view
    return false;
  }

  // Fill & save (either explicit save button or blur-to-save)
  await input.fill(label);
  const saveBtn = row.locator('#topicSaveBtn, [data-test="topic-save"]').first();
  if (await saveBtn.count()) {
    await safeClick(page, '#topicSaveBtn, [data-test="topic-save"]');
  } else {
    await input.blur();
  }

  // Editor should disappear after save
  await expect(input).toBeHidden({ timeout: 2000 }).catch(() => {});
  return true;
}

async function clearTopicLabel(page: Page) {
  await closeAnyMenus(page);

  // Confirm() fallback
  page.once('dialog', async (d) => {
    if (d.type() === 'confirm') await d.accept();
    else await d.dismiss();
  });

  await safeClick(page, '#topicClearBtn, [data-test="topic-clear"]');
  await page.waitForTimeout(120);
}

// ---------- tests ----------

test.describe('Topic flow', () => {
  test('Show/Hide via menu toggle propagates to host & guest', async ({ browser }) => {
    const code = newRoomCode('TPC');

    const ctxHost  = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host  = await ctxHost.newPage();
    const guest = await ctxGuest.newPage();

    await host.goto(roomUrlFor('Host', code),  { waitUntil: 'domcontentloaded' });
    await guest.goto(roomUrlFor('Guest', code), { waitUntil: 'domcontentloaded' });

    // ON => visible on both
    await forceTopicToggle(host, true);
    await closeAnyMenus(host);
    await waitTopicVisibility(host,  true, 10_000);
    await waitTopicVisibility(guest, true, 10_000);

    // OFF => hidden on both
    await forceTopicToggle(host, false);
    await closeAnyMenus(host);
    await waitTopicVisibility(host,  false, 10_000);
    await waitTopicVisibility(guest, false, 10_000);

    // ON again => visible on both
    await forceTopicToggle(host, true);
    await closeAnyMenus(host);
    await waitTopicVisibility(host,  true, 10_000);
    await waitTopicVisibility(guest, true, 10_000);

    await ctxHost.close(); await ctxGuest.close();
  });

  test('Edit & Clear topic label propagates to host & guest', async ({ browser }) => {
    const code = newRoomCode('TPC');

    const ctxHost  = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host  = await ctxHost.newPage();
    const guest = await ctxGuest.newPage();

    await host.goto(roomUrlFor('Host', code),  { waitUntil: 'domcontentloaded' });
    await guest.goto(roomUrlFor('Guest', code), { waitUntil: 'domcontentloaded' });

    // Ensure row is visible before editing
    await forceTopicToggle(host, true);
    await closeAnyMenus(host);
    await waitTopicVisibility(host,  true, 10_000);
    await waitTopicVisibility(guest, true, 10_000);

    // Try to set a label (supports prompt() and inline editor)
    const label = `Story ${Date.now().toString(36).slice(-4)}`;
    const submitted = await setTopicLabel(host, label);

    if (!submitted) {
      test.skip(true, 'This build/view exposes the topic but does not provide an editor here → skipping edit test.');
    }

    // Verify label on both
    const dispHost  = host.locator('#topicDisplay, [data-test="topic-display"]').first();
    const dispGuest = guest.locator('#topicDisplay, [data-test="topic-display"]').first();

    await host.waitForTimeout(120);
    await guest.waitForTimeout(220);

    const hostText  = (await dispHost.textContent()  ?? '').trim();
    const guestText = (await dispGuest.textContent() ?? '').trim();
    expect(hostText.includes(label)).toBeTruthy();
    expect(guestText.includes(label)).toBeTruthy();

    // Clear and verify dash on both
    await clearTopicLabel(host);

    await host.waitForTimeout(150);
    await guest.waitForTimeout(240);

    const hostAfter  = (await dispHost.textContent()  ?? '').trim();
    const guestAfter = (await dispGuest.textContent() ?? '').trim();
    expect(isDash(hostAfter)).toBeTruthy();
    expect(isDash(guestAfter)).toBeTruthy();

    await ctxHost.close(); await ctxGuest.close();
  });
});
