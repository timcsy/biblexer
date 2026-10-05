// 守護：沒有 Cache Storage 的環境（區網 http 等非安全來源、部分無痕模式）仍能連網使用，並以中性文字說明無法離線保存
import { expect, test } from '@playwright/test';
import { search } from './helpers.ts';

test('沒有 Cache Storage 與 Service Worker：連網載入、可搜尋，並說明此連線無法離線保存', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as { caches?: unknown }).caches;
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByTestId('online-only')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('status-keyword-ready')).toBeVisible({ timeout: 120_000 });
  await search(page, '迦拿');
  await expect(page.getByTestId('result').first()).toBeVisible();
  expect(errors).toEqual([]);
});
