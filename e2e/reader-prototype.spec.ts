// 原型（prototype-strip）：冊頁長卷、版面切換、進度提示
import { expect, test } from '@playwright/test';
import { openReader, waitReady } from './helpers.ts';

test('長卷：第 6 頁之後的第 7 頁接在右邊同一列；進度提示跟著閱讀位置', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  await expect(reader).toHaveAttribute('data-arrangement', 'strip');
  await expect(page.getByTestId('reader-progress')).toContainText('第 1 章 · 第 1／');
  // 桌機一次一頁：翻 6 次到第 7 頁（索引 6）
  for (let i = 0; i < 6; i++) await page.keyboard.press('PageDown');
  await expect(page.getByTestId('reader-progress')).toContainText('第 7／');
  const prev = (await page.locator('[data-testid="line"][data-line="5:1:0"]').boundingBox())!;
  const next = (await page.locator('[data-testid="line"][data-line="6:0:0"]').boundingBox())!;
  expect(next.y).toBeCloseTo(prev.y, 0);
  expect(next.x).toBeGreaterThan(prev.x);
});

test('版面切換：每列六頁與長卷之間切換，經節座標不變；選擇在重新整理後保留', async ({ page }) => {
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  const v = reader.locator('[data-testid="verse"][data-ref="45:1:1"]');
  const pos = await v.getAttribute('data-pos');
  await page.getByTestId('arrangement-toggle').click();
  await expect(reader).toHaveAttribute('data-arrangement', 'grid');
  await expect(v).toHaveAttribute('data-pos', pos!);
  await page.reload();
  await expect(page.getByTestId('status-keyword-ready')).toBeVisible({ timeout: 120_000 });
  await openReader(page);
  await expect(page.getByTestId('reader')).toHaveAttribute('data-arrangement', 'grid');
  await page.getByTestId('arrangement-toggle').click();
  await expect(page.getByTestId('reader')).toHaveAttribute('data-arrangement', 'strip');
});

test('長卷模式下縮小到書卷層再放大回來，仍回到原本的著陸點', async ({ page }) => {
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  for (let i = 0; i < 9; i++) await page.keyboard.press('PageDown');
  const focus = (await reader.getAttribute('data-focus'))!;
  await page.getByTestId('zoom-out').click();
  await page.getByTestId('zoom-out').click();
  await expect(reader).toHaveAttribute('data-level', 'book');
  await page.getByTestId('zoom-in').click();
  await page.getByTestId('zoom-in').click();
  await expect(reader).toHaveAttribute('data-level', 'reading');
  await expect(reader).toHaveAttribute('data-landing', focus);
});

test('拖動進度條到第 8 章刻度：拖動中顯示「第 8 章」，放手後停在第 8 章開頭', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const track = (await page.getByTestId('reader-scrub').boundingBox())!;
  const tick = (await page.locator('[data-testid="scrub-tick"][data-chapter="8"]').boundingBox())!;
  await page.mouse.move(track.x + 2, track.y + track.height / 2);
  await page.mouse.down();
  await page.mouse.move(tick.x + 1, track.y + track.height / 2, { steps: 10 });
  await expect(page.getByTestId('reader-progress')).toContainText('第 8 章');
  await page.mouse.up();
  const reader = page.getByTestId('reader');
  await expect(reader).toHaveAttribute('data-level', 'reading');
  await expect(reader.locator('[data-testid="verse"][data-ref="45:8:1"]')).toBeInViewport();
});

test('書卷層點章號、段落輪廓點段落：直接進入精讀的那個位置', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  await page.getByTestId('zoom-out').click();
  await page.getByTestId('zoom-out').click();
  await expect(reader).toHaveAttribute('data-level', 'book');
  await page.locator('[data-testid="book-chapter"][data-chapter="12"]').click();
  await expect(reader).toHaveAttribute('data-level', 'reading');
  await expect(reader.locator('[data-testid="verse"][data-ref="45:12:1"]')).toBeInViewport();

  await page.getByTestId('zoom-out').click();
  await expect(reader).toHaveAttribute('data-level', 'outline');
  const para = page.locator('[data-testid="outline-para"]').nth(2);
  const range = (await para.getAttribute('data-range'))!;
  await para.click();
  await expect(reader).toHaveAttribute('data-level', 'reading');
  await expect(reader.locator(`[data-testid="verse"][data-ref="45:${range.split('–')[0]}"]`)).toBeInViewport();
});
