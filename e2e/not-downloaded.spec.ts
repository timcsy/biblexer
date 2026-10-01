// US6：資料未下載完成又離線時，顯示需要先連網下載的說明（Edge Cases）
import { expect, test } from '@playwright/test';

test('下載中斷後離線重新開啟：顯示「需要先連網完成一次下載」', async ({ page, context }) => {
  await page.route('**/data/vectors.*', (route) => route.abort());
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect(page.getByTestId('download-error')).toBeVisible({ timeout: 120_000 });
  await page.unroute('**/data/vectors.*');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('need-download')).toContainText('需要先連網完成一次下載');
});
