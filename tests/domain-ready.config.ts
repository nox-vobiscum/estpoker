import { defineConfig } from '@playwright/test';

// Explicit opt-in suite: no TLS bypass, retries or skipped readiness checks.
process.env.PP_CANONICAL_ORIGIN = 'https://ep.rbsnet.at';
export default defineConfig({
  testDir: '.',
  testMatch: ['seo.spec.ts', 'domain-migration/ready.check.ts'],
  workers: 1,
  retries: 0,
  timeout: 30_000,
  use: { baseURL: process.env.PP_DOMAIN_TEST_URL || 'https://planning-poker.at', ignoreHTTPSErrors: false },
});
