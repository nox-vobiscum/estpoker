import { test, expect } from '@playwright/test';

test('new domain serves invite and room with a working same-origin WebSocket', async ({ page, baseURL }) => {
  const room = `domain-${Date.now()}`;
  const invite = await page.goto(`/invite?roomCode=${room}`);
  expect(invite?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  const socketPromise = page.waitForEvent('websocket');
  await page.goto(`/room?roomCode=${room}&participantName=DomainCheck`);
  const socket = await socketPromise;
  const endpoint = new URL(socket.url());
  expect(endpoint.host).toBe(new URL(baseURL!).host);
  expect(endpoint.protocol).toBe(new URL(baseURL!).protocol === 'https:' ? 'wss:' : 'ws:');
  expect(endpoint.pathname).toBe('/gameSocket');
  await expect(page.locator('body')).toHaveClass(/is-host/);
  await expect(page.locator('#cardGrid button').first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await page.locator('#cardGrid button').filter({ hasText: /^5$/ }).click();
  await page.locator('#revealButton').click();
  await expect(page.locator('#averageVote')).toHaveText(/^5([.,]0+)?$/);
});
