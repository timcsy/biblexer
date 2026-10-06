// 原型第四版：心智圖風格（雙曲幾何不變，只換視覺語言）——中心主題、彩色漸細分支、名稱在分支末端
import { expect, test } from '@playwright/test';
import { openReader, waitReady } from './helpers.ts';

test('心智圖：焦點書卷是中心主題；分支依類別著色、由粗漸細；點章號進入', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-out').click();
  for (let i = 0; i < 4 && (await reader.getAttribute('data-canon-style')) !== 'mindmap'; i++) await page.getByTestId('canonstyle-toggle').click();
  await expect(reader).toHaveAttribute('data-canon-style', 'mindmap');
  const map = page.getByTestId('hyper-canon');
  await expect(map).toHaveAttribute('data-variant', 'mindmap');
  await expect(map.getByTestId('mind-center')).toHaveText('羅馬書');
  const branches = map.locator('[data-testid="hyper-edge"]');
  expect(await branches.count()).toBeGreaterThan(60);
  // 依類別著色：至少出現 4 種類別色；越靠近中心的分支越粗
  const cats = new Set(await branches.evaluateAll((els) => els.map((e) => e.getAttribute('data-category'))));
  expect(cats.size).toBeGreaterThanOrEqual(4);
  const widths = await map.locator('[data-testid="hyper-edge"][data-kind="chapter"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('stroke-width'))));
  const outer = await map.locator('[data-testid="hyper-edge"][data-kind="book"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('stroke-width'))));
  expect(Math.max(...widths)).toBeGreaterThan(Math.min(...outer));
  await map.locator('[data-testid="hyper-chapter"][data-chapter="8"]').click();
  await expect(reader).toHaveAttribute('data-level', 'reading');
  await expect(page.locator('[data-testid="verse"][data-ref="45:8:1"]')).toBeInViewport();
});
