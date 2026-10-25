import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    channel:
      process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/server.mjs',
      url: 'http://127.0.0.1:5011/api/v1/health',
      reuseExistingServer: false,
      env: { NODE_ENV: 'test' },
      timeout: 60000,
    },
    {
      command: 'npm run dev --workspace client -- --port 5174',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: 'http://127.0.0.1:5011' },
      timeout: 60000,
    },
  ],
});
