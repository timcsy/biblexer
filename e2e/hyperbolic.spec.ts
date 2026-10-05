// 原型：正典的雙曲全貌——焦點在圓心、點書卷換焦點、點焦點書卷的章進入精讀
import { expect, test } from '@playwright/test';
import { openReader, waitReady } from './helpers.ts';

test('雙曲全貌：目前書卷在圓心；點另一卷換焦點；點該卷的章進入那一章', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-out').click();
  await expect(reader).toHaveAttribute('data-level', 'canon');
  if ((await reader.getAttribute('data-canon-style')) !== 'hyperbolic') await page.getByTestId('canonstyle-toggle').click();
  const disk = page.getByTestId('hyper-canon');
  await expect(disk).toBeVisible();
  await expect(disk).toHaveAttribute('data-focus-book', '45');
  // 只有焦點書卷顯示章號（畫面線索）
  await expect(disk.locator('[data-testid="hyper-chapter"][data-book="45"]')).toHaveCount(16);
  await expect(disk.locator('[data-testid="hyper-chapter"][data-book="1"]')).toHaveCount(0);

  await disk.locator('[data-testid="hyper-book"][data-book="46"]').click();
  await expect(disk).toHaveAttribute('data-focus-book', '46');
  await expect(disk.locator('[data-testid="hyper-chapter"][data-book="46"]')).toHaveCount(16);
  await disk.locator('[data-testid="hyper-chapter"][data-book="46"][data-chapter="13"]').click();
  await expect(page.getByTestId('reader-title')).toHaveText('哥林多前書');
  await expect(page.getByTestId('reader')).toHaveAttribute('data-level', 'reading');
  await expect(page.locator('[data-testid="verse"][data-ref="46:13:1"]')).toBeInViewport();
});
