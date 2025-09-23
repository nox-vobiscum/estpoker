import { test, expect } from '@playwright/test';

test.describe('Invite name availability check', () => {

  test('shows inline banner and accepts suggestion', async ({ page }) => {
    // Stub the availability API to say "Bob" is taken, suggest "Bob (2)"
    await page.route('**/api/rooms/*/name-available?**', async route => {
      const url = new URL(route.request().url());
      const name = url.searchParams.get('name') || '';
      if (name.toLowerCase() === 'bob') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ available: false, suggestion: 'Bob (2)' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ available: true, suggestion: name }),
        });
      }
    });

    // Also intercept the POST /join to keep the test on the page
    let postedBody: string | null = null;
    await page.route('**/join', async route => {
      if (route.request().method() === 'POST') {
        postedBody = await route.request().postData() || '';
        // Simulate a redirect target quickly
        await route.fulfill({ status: 302, headers: { location: '/room?ok=1' }, body: '' });
      } else {
        await route.fallback();
      }
    });

    // Open invite page with a known room code in the query
    await page.goto('/invite?roomCode=Y');

    const name = page.locator('input[name="participantName"]');
    const room = page.locator('input[name="roomCode"]');
    const form = page.locator('form[action="/join"]');

    await expect(room).toHaveValue('Y'); // the template should set it; adjust if needed
    await name.fill('Bob');

    // Submit → should show inline banner (no navigation yet)
    await form.evaluate((f: any) => f.requestSubmit());
    const banner = page.locator('#nameCheckNotice');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Name already in use');
    await expect(banner).toContainText('Bob (2)');

    // Click primary action → input is updated and form is submitted
    await page.click('#nameCheckNotice #nameUseSuggestion');

    // We should have posted with participantName=Bob (2)
    expect(postedBody).not.toBeNull();
    expect(postedBody!).toMatch(/participantName=Bob\+%282%29/);
  });

});
