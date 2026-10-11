import { defineConfig } from '@playwright/test';
import ready from './domain-ready.config';

process.env.PP_CANONICAL_ORIGIN = 'https://planning-poker.at';
export default defineConfig(ready, {
  testMatch: ['seo.spec.ts', 'domain-migration/ready.check.ts', 'domain-migration/redirect.check.ts'],
});
