// Minimal E2E for Menu → Room toggle event contracts (CommonJS, runtime recorder)
// Env:
//   EP_ROOM_URL  = full room URL (overrides base)
//   EP_BASE_URL  = base like http://localhost:8080 (default if EP_ROOM_URL is not set)
// Default when EP_ROOM_URL is not provided:
//   <EP_BASE_URL>/room?participantName=E2E&roomCode=E2E-0001

const { test, expect } = require('@playwright/test');

function resolveRoomUrl() {
  const base = process.env.EP_BASE_URL || 'http://localhost:8080';
  const room = process.env.EP_ROOM_URL || `${base.replace(/\/$/, '')}/room?participantName=E2E&roomCode=E2E-0001`;
  return room;
}

// Attach event listeners inside the already-loaded document
async function attachEventRecorder(page) {
  await page.evaluate(() => {
    window.__epE2EEvents = [];
    const capture = (name) => {
      document.addEventListener(name, (ev) => {
        try {
          const detail = ev && ev.detail ? { ...ev.detail } : null;
          window.__epE2EEvents.push({ name, detail });
        } catch {
          window.__epE2EEvents.push({ name, detail: null });
        }
      });
    };
    ['ep:auto-reveal-toggle', 'ep:topic-toggle', 'ep:participation-toggle'].forEach(capture);
  });
}

// Wait until a specific custom event is recorded and return it
async function waitForCaptured(page, name) {
  await page.waitForFunction((evName) => {
    return Array.isArray(window.__epE2EEvents) &&
           window.__epE2EEvents.some(e => e && e.name === evName);
  }, name);
  return page.evaluate((evName) => {
    return window.__epE2EEvents.find(e => e.name === evName);
  }, name);
}

test.describe('Menu → Room toggle event contracts', () => {
  test('page loads without console errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(resolveRoomUrl(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);
    expect(errors, `Console errors:\n${errors.join('\n')}`).toHaveLength(0);
  });

  test('auto-reveal / topic / participation dispatch correct CustomEvents', async ({ page }) => {
    await page.goto(resolveRoomUrl(), { waitUntil: 'domcontentloaded' });

    // Recorder MUST be attached before interacting with the UI
    await attachEventRecorder(page);

    // Open the menu overlay
    await page.locator('#menuButton').click();
    await expect(page.locator('#appMenuOverlay')).toBeVisible();

    // Robust toggle helper for checkbox-like controls
    async function toggle(selector) {
      const el = page.locator(selector);
      await expect(el, `Missing element ${selector}`).toHaveCount(1);
      await el.scrollIntoViewIfNeeded();
      const before = await el.isChecked().catch(() => undefined);
      await el.click({ force: true });
      await page.waitForTimeout(80);
      const after = await el.isChecked().catch(() => before);
      if (before !== undefined && after === before) {
        // Retry once if a custom UI ate the first click
        await el.click({ force: true });
        await page.waitForTimeout(80);
      }
    }

    // --- Auto-reveal ---
    await toggle('#menuAutoRevealToggle');
    let ev = await waitForCaptured(page, 'ep:auto-reveal-toggle');
    expect(ev && ev.detail, 'Missing detail for auto-reveal').toBeTruthy();
    expect(typeof ev.detail.on, 'detail.on must be boolean').toBe('boolean');

    // --- Topic visible ---
    await toggle('#menuTopicToggle');
    ev = await waitForCaptured(page, 'ep:topic-toggle');
    expect(ev && ev.detail, 'Missing detail for topic').toBeTruthy();
    expect(typeof ev.detail.on, 'detail.on must be boolean (topic)').toBe('boolean');

    // --- Participation (estimating vs observer) ---
    await toggle('#menuParticipationToggle');
    ev = await waitForCaptured(page, 'ep:participation-toggle');
    expect(ev && ev.detail, 'Missing detail for participation').toBeTruthy();
    expect(typeof ev.detail.estimating, 'detail.estimating must be boolean').toBe('boolean');
  });
});
