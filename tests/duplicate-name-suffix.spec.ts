import { test, expect } from '@playwright/test';

test('Second user with the same requested name is redirected to /invite (server 4005)', async ({ page, browser }) => {
  const room = `dupe-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const requested = 'Max';

  // 1) First user joins via /room (keeps the name)
  await page.goto(`/room?roomCode=${encodeURIComponent(room)}&participantName=${encodeURIComponent(requested)}`);
  await expect(page).toHaveURL(/\/room(\?|$)/);
  await expect(page.locator('#youName')).toBeVisible({ timeout: 15000 });

  // 2) Second, isolated context attempts to join with the same name
  const ctx2 = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const p2 = await ctx2.newPage();
  await p2.goto(`/room?roomCode=${encodeURIComponent(room)}&participantName=${encodeURIComponent(requested)}`);

  // Expect redirect to invite with a collision flag
  await expect(p2).toHaveURL(/\/invite(\?|$)/, { timeout: 20000 });
  await expect(p2).toHaveURL(/nameTaken=1/, { timeout: 20000 });

  // Invite form is present and name prefilled
  await expect(p2.locator('form[action="/join"]')).toBeVisible();
  await expect(p2.locator('input[name="participantName"]')).toHaveValue(requested);

  // (Optional) room code is carried over
  const rc = await p2.locator('input[name="roomCode"]').inputValue();
  expect(rc).toBe(room);

  await ctx2.close();
});
