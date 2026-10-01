// US6：首次載入進度、模型就緒前可用關鍵字、就緒後自動更新（FR-019、FR-020）
import { expect, test } from '@playwright/test';
import { search } from './helpers.ts';

test('首次載入：顯示進度；模型就緒前可用關鍵字搜尋；就緒後結果自動更新並顯示「已可離線使用」', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route('**/model_quantized.onnx', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByTestId('download-progress')).toBeVisible();
  await expect(page.getByTestId('status-keyword-ready')).toBeVisible({ timeout: 120_000 });
  await search(page, '迦拿');
  await expect(page.getByTestId('results')).toHaveAttribute('data-semantic', 'false');
  release();
  await expect(page.getByTestId('offline-ready')).toBeVisible({ timeout: 180_000 });
  await expect(page.getByTestId('status-semantic-ready')).toBeVisible();
  await expect(page.getByTestId('results')).toHaveAttribute('data-semantic', 'true');
});
