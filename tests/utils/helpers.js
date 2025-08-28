// tests/utils/helpers.js

export function roomUrlFor(name, roomCode) {
  const base =
    process.env.EP_ROOM_URL ||
    process.env.EP_BASE_URL && `${process.env.EP_BASE_URL.replace(/\/$/, '')}/room` ||
    'http://localhost:8080/room';
  const qs = new URLSearchParams({ participantName: name, roomCode });
  return `${base}?${qs.toString()}`;
}

export async function ensureMenuOpen(page) {
  const btn = page.locator('#menuButton');
  const overlay = page.locator('#appMenuOverlay');
  await btn.click();
  await page.waitForFunction(() => {
    const ov = document.querySelector('#appMenuOverlay');
    return ov && ov.getAttribute('aria-hidden') === 'false';
  });
  await overlay.waitFor({ state: 'visible' });
}

export async function ensureMenuClosed(page) {
  const overlay = page.locator('#appMenuOverlay');
  const isOpen = await overlay.isVisible();
  if (isOpen) {
    // backdrop click closes
    await page.locator('.menu-backdrop').click({ position: { x: 5, y: 5 } });
    await page.waitForFunction(() => {
      const ov = document.querySelector('#appMenuOverlay');
      return ov && ov.getAttribute('aria-hidden') === 'true';
    });
  }
}
