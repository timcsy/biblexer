import { defineConfig, devices } from '@playwright/test';

// E2E 必須跑在 build + preview 上：dev server 不註冊 Service Worker。
export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
