// 守護：更新時只下載有變的檔案（2026-11-01）——資料版本變了、檔案內容沒變時，不重新下載任何資料、模型、ORT 檔
import { expect, test } from '@playwright/test';

// 不經 Service Worker：讓測試能攔截頁面的請求（下載本來就由頁面進行，存進 Cache Storage）
test.use({ serviceWorkers: 'block' });

test('資料版本變了但內容沒變：第二次開啟時 0 個檔案重新下載，舊版本快取被換掉', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/');
  await expect(page.getByTestId('status-semantic-ready')).toBeVisible({ timeout: 180_000 });
  const before = await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('biblexer-')));
  expect(before).toHaveLength(1);

  // 新版 manifest：只改資料版本（模擬重新部署，內容相同）
  await page.route('**/data/manifest.json', async (route) => {
    const res = await route.fetch();
    const m = (await res.json()) as { dataVersion: string };
    await route.fulfill({ response: res, json: { ...m, dataVersion: `${m.dataVersion}-changed` } });
  });
  // 只記錄頁面主執行緒的 fetch（下載都由頁面進行）；Worker 的請求不經過這裡——
  // 測試擋掉了 Service Worker，Worker 載入模型會直接上網，那不是「更新下載」
  await page.addInitScript(() => {
    const w = window as unknown as { __fetched: string[] };
    w.__fetched = [];
    const orig = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      w.__fetched.push(new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href).pathname);
      return orig(input, init);
    };
  });
  await page.reload();
  await expect(page.getByTestId('status-semantic-ready')).toBeVisible({ timeout: 180_000 });
  const fetched = await page.evaluate(() => (window as unknown as { __fetched: string[] }).__fetched);
  expect(fetched.filter((u) => /\/(data|models|ort)\//.test(u) && !u.endsWith('/manifest.json'))).toEqual([]);
  const after = await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('biblexer-')));
  expect(after).toHaveLength(1);
  expect(after[0]).not.toBe(before[0]);
});
