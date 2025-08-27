/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  // Only look for tests in ./tests
  testDir: './tests',
  testMatch: /.*\.spec\.js$/,

  // Make CI runs deterministic & fast
  reporter: [['line']],
  workers: 1,

  // Reasonable timeouts for E2E
  timeout: 20_000,
  expect: { timeout: 5_000 },

  // Default baseURL (overridden by EP_BASE_URL env in your tests)
  use: {
    headless: true,
    baseURL: process.env.EP_BASE_URL || 'http://localhost:8080',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },
};

module.exports = config;
