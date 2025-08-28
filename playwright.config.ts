import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  use: { baseURL: process.env.EP_BASE_URL || 'http://localhost:8080' },
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
});
