import { defineConfig, devices } from '@playwright/test';

// E2E 必須跑在 build + preview 上：dev server 不註冊 Service Worker。
// 埠號可用 E2E_PORT 覆寫（預設 4173），以免與其他專案的 preview 衝突。
const PORT = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'allow',
    // 閱讀器的過場動畫在「減少動態效果」時不播放：測試只看最終著陸點
    reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
