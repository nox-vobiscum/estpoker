import { defineConfig } from '@playwright/test';

process.env.PP_CANONICAL_ORIGIN = 'https://planning-poker.at';
export default defineConfig({
  testDir: '.',
  testMatch: ['seo.spec.ts', 'domain-migration/ready.check.ts'],
  workers: 1,
  retries: 0,
  timeout: 30_000,
  use: { baseURL: process.env.PP_DOMAIN_TEST_URL || 'https://planning-poker.at', ignoreHTTPSErrors: false },
});
