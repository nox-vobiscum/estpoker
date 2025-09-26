// tests/kick-flow.spec.js
// Kick flow E2E (robust + debug):
// - Host sees a "Kick" control in another participant's row
// - Clicking shows confirm() (EN/DE) including the target name
// - After accepting, the kicked participant navigates away from /room

const { test, expect } = require('@playwright/test');

function baseUrl() { return process.env.EP_BASE_URL || 'http://localhost:8080'; }
function newRoomCode() { return `KCK-${Date.now().toString(36).slice(-6)}`; }
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

async function waitRoomReady(page, timeout = 20000) {
  await expect(page.locator('#cardGrid')).toHaveCount(1);
  await page.waitForSelector('#liveParticipantList', { timeout });
  await page.waitForFunction(() => {
    const list = document.querySelector('#liveParticipantList');
    return !!list && list.querySelectorAll('.participant-row, .p-row').length >= 1;
  }, undefined, { timeout });
}

function escapeReg(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function waitRowByName(page, name, timeout = 20000) {
  const sel = '#liveParticipantList .participant-row, #liveParticipantList .p-row';
  // ✅ pass args object as 2nd param; options (timeout) as 3rd param
  await page.waitForFunction(({ sel, name }) => {
    const rows = Array.from(document.querySelectorAll(sel));
    return rows.some(r => {
      const cell = r.querySelector('.name, .p-name');
      return cell && cell.textContent && cell.textContent.trim() === name;
    });
  }, { sel, name }, { timeout });

  return page.locator(sel, {
    has: page.locator('.name, .p-name', { hasText: new RegExp(`^${escapeReg(name)}$`) })
  }).first();
}

async function findKickButtonInRow(page, row) {
  // Try to reveal hover-only controls
  await row.hover().catch(() => {});
  const right = row.locator('.row-right');
  if (await right.count()) await right.hover().catch(() => {});

  // Fallback selector cascade: class, EN/DE labels, optional test hook
  const kickSelectors = [
    'button.row-action.kick',
    'button[aria-label*="kick" i]',
    'button[title*="kick" i]',
    'button[aria-label*="entfern" i]', // “entfernen”
    'button[title*="entfern" i]',
    '[data-act="kick"]'
  ].join(', ');

  return row.locator(kickSelectors).first();
}

test.describe('Kick flow', () => {
  test('Host kicks a participant → confirm dialog (en/de) and participant leaves /room', async ({ browser }) => {
    const roomCode = newRoomCode();
    const hostName = 'Queen';
    const victimName = 'Pawn';

    const ctxHost   = await browser.newContext();
    const ctxVictim = await browser.newContext();
    const host   = await ctxHost.newPage();
    const victim = await ctxVictim.newPage();

    // Join (host first)
    await host.goto(roomUrlFor(hostName, roomCode),     { waitUntil: 'domcontentloaded' });
    await victim.goto(roomUrlFor(victimName, roomCode), { waitUntil: 'domcontentloaded' });

    await waitRoomReady(host);

    // Wait until the victim’s row appears on the host page
    const victimRow = await waitRowByName(host, victimName);
    await expect(victimRow).toHaveCount(1);

    // Find a kick control inside that row
    const kickBtn = await findKickButtonInRow(host, victimRow);

    // If not visible yet, allow a short grace + re-hover
    if (!(await kickBtn.isVisible().catch(() => false))) {
      await victimRow.hover().catch(() => {});
      await host.waitForTimeout(200);
    }

    if (await kickBtn.count() === 0 || !(await kickBtn.isVisible().catch(() => false))) {
      // Dump the row HTML to log for diagnostics, then fail
      const html = await victimRow.evaluate(el => el.outerHTML).catch(() => '<no outerHTML>');
      console.log('[kick-flow] Could not find kick button. Row HTML:\n', html);
      await expect(kickBtn, 'Kick control not found in victim row').toBeVisible();
    }

    // Capture confirm dialog
    let confirmMsg = '';
    host.once('dialog', async (dlg) => { confirmMsg = dlg.message(); await dlg.accept(); });

    await kickBtn.click();

    // Confirm text (EN/DE) including the exact victim name
    const re = new RegExp(`^(Remove\\s+${escapeReg(victimName)}\\?|${escapeReg(victimName)}\\s+wirklich\\s+entfernen\\?)$`);
    expect(confirmMsg, 'Confirm dialog not shown').toBeTruthy();
    expect(re.test(confirmMsg)).toBeTruthy();

    // Victim should leave /room (redirect to index)
    const prevUrl = victim.url();
    await victim.waitForFunction(() => !location.pathname.startsWith('/room'), undefined, { timeout: 10000 }).catch(() => {});
    const nowUrl = victim.url();
    expect(
      !new URL(nowUrl).pathname.startsWith('/room'),
      `Victim did not leave /room (prev: ${prevUrl}, now: ${nowUrl})`
    ).toBeTruthy();

    await ctxHost.close();
    await ctxVictim.close();
  });
});
