import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir: 'test', testMatch: '*.spec.ts', fullyParallel: false, workers: 1, timeout: 20000,
  use: { baseURL: 'http://127.0.0.1:5187', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev:fixture -- --port 5187', url: 'http://127.0.0.1:5187', reuseExistingServer: false },
  projects: [
    { name: 'Chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'Firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'WebKit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 7'], channel: 'chrome' } },
    { name: 'Mobile WebKit', use: { ...devices['iPhone 13'] } },
  ],
});
