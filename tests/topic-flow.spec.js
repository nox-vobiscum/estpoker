// Topic flow E2E (stable):
// - Show/Hide via menu toggle propagates to all clients
// - Edit & Save updates label for all clients
// - Clear resets label to "—" on all clients
// Run:
//   npx playwright test tests/topic-flow.spec.js

const { test, expect } = require('@playwright/test');

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() { return `TPC-${Date.now().toString(36).slice(-6)}`; }
function roomUrlFor(name, roomCode) {
  const full = process.env.EP_ROOM_URL;
  if (full) {
    const u = new URL(full);
    u.searchParams.set('participantName', name);
    u.searchParams.set('roomCode', roomCode);
    return u.toString();
  }
  const u = new URL(`${baseUrl().replace(/\/$/,'')}/room`);
  u.searchParams.set('participantName', name);
  u.searchParams.set('roomCode', roomCode);
  return u.toString();
}

async function ensureMenuOpen(page) {
  const overlay = page.locator('#appMenuOverlay');
  if (!(await overlay.isVisible().catch(()=>false))) {
    await page.locator('#menuButton').click();
    await expect(overlay).toBeVisible();
  }
}
async function ensureMenuClosed(page) {
  const overlay = page.locator('#appMenuOverlay');
  if (await overlay.isVisible().catch(()=>false)) {
    await page.locator('#menuButton').click();
    await expect(overlay).toBeHidden();
  }
}
async function ensureToggleState(page, selector, desiredChecked) {
  const el = page.locator(selector);
  await expect(el).toHaveCount(1);
  const now = await el.isChecked();
  if (now !== desiredChecked) {
    await el.click({ force: true });
  }
  // give WS a moment
  await page.waitForTimeout(180);
}

// Visible helper: robust against style-toggling
async function waitRowVisible(page, timeout = 3500) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#topicRow');
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }, null, { timeout });
}
async function waitRowHidden(page, timeout = 3500) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#topicRow');
    if (!el) return true;
    const style = getComputedStyle(el);
    return style.display === 'none' || style.visibility === 'hidden';
  }, null, { timeout });
}

test.describe('Topic flow', () => {
  test('Show/Hide via menu toggle propagates to host & guest', async ({ browser }) => {
    const roomCode = newRoomCode();

    const ctxHost  = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host  = await ctxHost.newPage();
    const guest = await ctxGuest.newPage();

    await host.goto(roomUrlFor('Host', roomCode),  { waitUntil: 'domcontentloaded' });
    await guest.goto(roomUrlFor('Guest', roomCode), { waitUntil: 'domcontentloaded' });

    // Ensure both pages have the row
    await expect(host.locator('#topicRow')).toHaveCount(1);
    await expect(guest.locator('#topicRow')).toHaveCount(1);

    // Toggle ON → both visible
    await ensureMenuOpen(host);
    await ensureToggleState(host, '#menuTopicToggle', true);
    await ensureMenuClosed(host);

    await waitRowVisible(host);
    await guest.waitForTimeout(120);
    await waitRowVisible(guest);

    // Toggle OFF → both hidden
    await ensureMenuOpen(host);
    await ensureToggleState(host, '#menuTopicToggle', false);
    await ensureMenuClosed(host);

    await waitRowHidden(host);
    await guest.waitForTimeout(120);
    await waitRowHidden(guest);

    // Toggle ON again → both visible
    await ensureMenuOpen(host);
    await ensureToggleState(host, '#menuTopicToggle', true);
    await ensureMenuClosed(host);

    await waitRowVisible(host);
    await guest.waitForTimeout(120);
    await waitRowVisible(guest);

    await ctxHost.close(); await ctxGuest.close();
  });

  test('Edit & Clear topic label propagates to host & guest', async ({ browser }) => {
    const roomCode = newRoomCode();

    const ctxHost  = await browser.newContext();
    const ctxGuest = await browser.newContext();
    const host  = await ctxHost.newPage();
    const guest = await ctxGuest.newPage();

    await host.goto(roomUrlFor('Host', roomCode),  { waitUntil: 'domcontentloaded' });
    await guest.goto(roomUrlFor('Guest', roomCode), { waitUntil: 'domcontentloaded' });

    // Make sure topic is visible before editing
    await ensureMenuOpen(host);
    await ensureToggleState(host, '#menuTopicToggle', true);
    await ensureMenuClosed(host);
    await waitRowVisible(host);

    const editBtn   = host.locator('#topicEditBtn');
    const editBox   = host.locator('#topicEdit');
    const input     = host.locator('#topicInput');
    const saveBtn   = host.locator('#topicSaveBtn');
    const clearBtn  = host.locator('#topicClearBtn');
    const dispHost  = host.locator('#topicDisplay');
    const dispGuest = guest.locator('#topicDisplay');

    await expect(editBtn).toBeVisible();
    await expect(clearBtn).toHaveCount(1);

    // Edit & save
    await editBtn.click();
    await expect(editBox).toBeVisible();
    const label = `Story ${Date.now().toString(36).slice(-4)}`;
    await input.fill(label);
    await saveBtn.click();
    await expect(editBox).toBeHidden();

    // Label shows on host and guest
    await host.waitForTimeout(180);
    const hostText = (await dispHost.textContent() || '').trim();
    expect(hostText.includes(label)).toBeTruthy();

    await guest.waitForTimeout(200);
    const guestText = (await dispGuest.textContent() || '').trim();
    expect(guestText.includes(label)).toBeTruthy();

    // Clear
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    await host.waitForTimeout(180);
    const hostAfter = (await dispHost.textContent() || '').trim();
    const guestAfter = (await dispGuest.textContent() || '').trim();
    expect(hostAfter).toBe('—');
    expect(guestAfter).toBe('—');

    await ctxHost.close(); await ctxGuest.close();
  });
});
