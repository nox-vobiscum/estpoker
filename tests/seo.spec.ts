import { test, expect } from '@playwright/test';

const origin = 'https://ep.rbsnet.at';

for (const lang of ['en', 'de']) {
  for (const path of ['/', '/about']) {
    test(`public metadata ${path} (${lang})`, async ({ page }) => {
      const response = await page.goto(`${path}?lang=${lang}&theme=light&utm_source=seo-test`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('title')).toHaveCount(1);
      const title = lang === 'en'
        ? (path === '/' ? 'Free Planning Poker Online – Scrum Estimation Tool | RBS'
          : 'What Is Planning Poker? Free Scrum Poker Tool | RBS')
        : (path === '/' ? 'Kostenloses Planning Poker online – Scrum-Schätztool | RBS'
          : 'Was ist Planning Poker? Kostenloses Scrum Poker | RBS');
      await expect(page).toHaveTitle(title);
      await expect(page.locator('meta[name="description"]')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', origin + path);
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
      await expect(page.locator('h1')).toHaveCount(1);
      for (const property of ['title', 'description', 'url', 'type', 'image']) {
        await expect(page.locator(`meta[property="og:${property}"]`)).toHaveCount(1);
      }
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', origin + path);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', title);
      await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', title);
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description?.length).toBeGreaterThan(80);
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', description!);

      const structured = page.locator('script[type="application/ld+json"]');
      await expect(structured).toHaveCount(path === '/' ? 1 : 0);
      if (path === '/') {
        const data = JSON.parse((await structured.textContent())!);
        expect(data).toMatchObject({ '@type': 'SoftwareApplication', url: origin + '/',
          operatingSystem: 'Web', offers: { price: '0', priceCurrency: 'EUR' } });
        expect(data.aggregateRating).toBeUndefined();
        await expect(page.locator('#joinForm')).toBeVisible();
        const content = page.locator('.landing-explainer');
        const words = (await content.innerText()).trim().split(/\s+/).length;
        expect(words).toBeGreaterThanOrEqual(250);
        expect(words).toBeLessThanOrEqual(400);
        expect(await page.locator('#joinForm').evaluate(el =>
          !!(el.compareDocumentPosition(document.querySelector('.landing-explainer')!)
            & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
      }
    });
  }
}

test('room and room invitations are noindex without public metadata', async ({ page }) => {
  for (const path of ['/room?roomCode=seo-check&participantName=Seo',
    '/room?roomCode=seo-check', '/invite?roomCode=seo-check']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
    if (path.includes('participantName')) await expect(page.locator('#cardGrid')).toBeVisible();
  }
  await page.goto('/invite');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await page.goto('/home?lang=en&utm_source=test');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', origin + '/');
});

test('crawl files and social image are served correctly', async ({ request, page }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  const rules = await robots.text();
  expect(rules).toContain('User-agent: *');
  expect(rules).toContain('Allow: /');
  expect(rules).toContain(`Sitemap: ${origin}/sitemap.xml`);
  expect(rules).not.toMatch(/Disallow:\s*\/(room|invite)/);
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toContain('xml');
  const xml = await sitemap.text();
  const parsed = await page.evaluate(text => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    return { errors: doc.querySelectorAll('parsererror').length,
      namespace: doc.documentElement.namespaceURI,
      urls: Array.from(doc.querySelectorAll('loc')).map(el => el.textContent) };
  }, xml);
  expect(parsed).toEqual({ errors: 0, namespace: 'http://www.sitemaps.org/schemas/sitemap/0.9',
    urls: [origin + '/', origin + '/about'] });
  const image = await request.get('/favicon-512.png');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/png');
});

test('language switching updates public content and metadata', async ({ page }) => {
  await page.goto('/?lang=en');
  await page.locator('#hcLangDE').click();
  await expect(page).toHaveTitle('Kostenloses Planning Poker online – Scrum-Schätztool | RBS');
  await expect(page.locator('#planning-poker-heading')).toHaveText('Kostenloses Online Planning Poker für agile Teams');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Kostenloses/);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'de_DE');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', origin + '/');
  await page.locator('#hcLangEN').click();
  await expect(page).toHaveTitle('Free Planning Poker Online – Scrum Estimation Tool | RBS');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Free online/);
});
