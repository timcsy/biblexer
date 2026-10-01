// US6：瀏覽器清除儲存空間後（Edge Cases、SC-005 相關）
import { expect, test } from '@playwright/test';
import { clearDataCaches } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('offline-ready')).toBeVisible({ timeout: 180_000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await clearDataCaches(page);
});

test('有網路時重新開啟會重新下載並顯示進度', async ({ page }) => {
  await page.reload();
  await expect(page.getByTestId('download-progress')).toBeVisible();
  await expect(page.getByTestId('offline-ready')).toBeVisible({ timeout: 180_000 });
});

test('無網路時顯示需要重新下載的說明', async ({ page, context }) => {
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('need-download')).toBeVisible();
});
