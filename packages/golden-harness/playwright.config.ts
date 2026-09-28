import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  webServer: {
    command: 'pnpm dev',
    port: 5174,
    reuseExistingServer: !process.env['CI'],
  },
  use: {
    baseURL: 'http://localhost:5174',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
