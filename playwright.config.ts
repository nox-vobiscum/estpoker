import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',

  /* Deterministic in CI */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: [
    ['line'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  /* Generelle Test-Timeouts */
  timeout: 30_000,
  expect: { timeout: 8_000 },

  use: {
    headless: true,
    baseURL: process.env.EP_BASE_URL || 'http://localhost:8080',

    /* etwas großzügiger wegen PROD */
    actionTimeout: 7_000,
    navigationTimeout: 25_000,

    /* Artefakte bei Fehlern */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
});
