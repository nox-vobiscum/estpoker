// tests/pw.e2e.config.ts
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT || '8080';
const BASE = process.env.EP_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'UTC',
    video: 'off',
  },
  webServer: {
    command: process.env.E2E_JAR === '1'
      ? 'npm run e2e:server:jar'
      : 'npm run e2e:server',
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      NODE_ENV: 'test',
    },
  },
  projects: [
    {
      name: 'chromium-e2e',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
