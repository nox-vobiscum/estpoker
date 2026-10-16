import { expect, test } from '@playwright/test';

const canonicalOrigin = (process.env.PP_CANONICAL_ORIGIN || 'https://planning-poker.at').replace(/\/+$/, '');

for (const language of ['en', 'de'] as const) {
  test(`About content is precise and complete in ${language}`, async ({ page }) => {
    const response = await page.goto(`/about?lang=${language}`);
    expect(response?.status()).toBe(200);

    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.about-section')).toHaveCount(5);
    await expect(page.locator('[data-i18n="about.features.title"] + .feature-list li')).toHaveCount(9);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${canonicalOrigin}/about`);
    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
    await expect(page.locator('.about-container')).not.toContainText(/about\.[a-z]/);

    const explanation = page.locator('.about-section').filter({
      has: page.locator('[data-i18n="about.what.title"]'),
    });
    await expect(explanation).not.toContainText(/prevents cognitive bias|verhindert kognitive/i);
    await expect(page.locator('[data-i18n="about.why.persistent"]')).not.toContainText(/persistent|persistenten/i);

    if (language === 'en') {
      await expect(explanation).toContainText('shared understanding');
      await expect(page.locator('[data-i18n="about.features.results"]')).toContainText('average, median, range and consensus');
      await expect(page.locator('[data-i18n="about.features.responsive"]')).toContainText('desktop, tablet and smartphone');
    } else {
      await expect(explanation).toContainText('gemeinsames Verständnis');
      await expect(page.locator('[data-i18n="about.features.results"]')).toContainText('Durchschnitt, Median, Spanne und Konsens');
      await expect(page.locator('[data-i18n="about.features.responsive"]')).toContainText('Desktop, Tablet und Smartphone');
    }
  });
}

test('About content switches between equivalent DE and EN copy', async ({ page }) => {
  await page.goto('/about?lang=en');
  await page.locator('#hcLangDE').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('[data-i18n="about.what.title"]')).toHaveText('Was ist Planning Poker?');
  await expect(page.locator('[data-i18n="about.features.outliers"]')).toContainText('Diskussionshilfe');

  await page.locator('#hcLangEN').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('[data-i18n="about.what.title"]')).toHaveText('What is Planning Poker?');
  await expect(page.locator('[data-i18n="about.features.outliers"]')).toContainText('discussion aid');
});
