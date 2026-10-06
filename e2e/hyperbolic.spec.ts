// 原型：正典的雙曲圓盤（與焦點樹、方塊並列比較）——焦點在圓心、畫出連線、點書卷換焦點、點章進入
import { expect, test } from '@playwright/test';
import { openReader, waitReady } from './helpers.ts';

test('雙曲全貌：目前書卷在圓心；點另一卷換焦點；點該卷的章進入那一章', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-out').click();
  await expect(reader).toHaveAttribute('data-level', 'canon');
  for (let i = 0; i < 3 && (await reader.getAttribute('data-canon-style')) !== 'disk'; i++) await page.getByTestId('canonstyle-toggle').click();
  const disk = page.getByTestId('hyper-canon');
  await expect(disk).toBeVisible();
  // 畫出樹的連線（父子之間的雙曲直線），讓結構看得見
  expect(await disk.getByTestId('hyper-edge').count()).toBeGreaterThan(60);
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

test('第二版：一進來就看到操作提示與舊約／新約；拖曳後放手吸附到最近的書卷', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-out').click();
  for (let i = 0; i < 3 && (await reader.getAttribute('data-canon-style')) !== 'disk'; i++) await page.getByTestId('canonstyle-toggle').click();
  await expect(reader).toHaveAttribute('data-canon-style', 'disk');
  await expect(page.getByTestId('hyper-hint')).toContainText('點書卷');
  await expect(page.getByTestId('hyper-testament')).toHaveCount(2);
  const disk = page.getByTestId('hyper-canon');
  const box = (await disk.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // 往右拖一大段：焦點往左移（舊約方向）；放手後吸附到某一卷（不是羅馬書）
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + box.width * 0.35, cy, { steps: 12 });
  await page.mouse.up();
  await expect(disk).not.toHaveAttribute('data-focus-book', '45');
  const focus = Number(await disk.getAttribute('data-focus-book'));
  expect(focus).toBeGreaterThanOrEqual(1);
  await expect(reader).toHaveAttribute('data-landing', `book:${focus}`);
});
