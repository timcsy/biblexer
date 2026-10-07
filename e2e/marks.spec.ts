// 守護：spec 006 FR-001～FR-006、SC-001～SC-004——讀者自己的記號
import { expect, test, type Page } from '@playwright/test';
import { openReader, overlaps, resultRefs, search, waitReady } from './helpers.ts';

const verse = (page: Page, ref: string) => page.locator(`[data-testid="verse"][data-ref="${ref}"]`);
const allPositions = (page: Page) => page.getByTestId('verse').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-ref')}@${e.getAttribute('data-pos')}`));

test('點節號加上／取消記號；重新整理後仍在；版面座標不變；經文卡沒有記號', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const before = await allPositions(page);
  await verse(page, '45:1:5').locator('.verseNum').click();
  await expect(verse(page, '45:1:5')).toHaveAttribute('data-marked', 'true');
  expect(await allPositions(page)).toEqual(before);
  // 再點一次取消，然後再加上
  await verse(page, '45:1:5').locator('.verseNum').click();
  await expect(verse(page, '45:1:5')).toHaveAttribute('data-marked', 'false');
  await verse(page, '45:1:5').locator('.verseNum').click();
  await page.reload();
  await expect(page.getByTestId('status-keyword-ready')).toBeVisible({ timeout: 120_000 });
  await openReader(page);
  await expect(verse(page, '45:1:5')).toHaveAttribute('data-marked', 'true');
  // 經文卡：記號不是卡片內容
  await page.getByTestId('reader-add-to-card').click();
  await page.getByTestId('reader-back').click();
  await page.getByTestId('card-toggle').click();
  await expect(page.getByTestId('card-item')).toHaveCount(1);
  await expect(page.locator('[data-testid="card-item"] [data-marked="true"], [data-testid="card-item"] .marked')).toHaveCount(0);
});

test('拉遠到書卷層：記號是色條，螢幕寬度至少 4 像素', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  await verse(page, '45:1:5').locator('.verseNum').click();
  const reader = page.getByTestId('reader');
  await page.getByTestId('zoom-out').click();
  await expect(reader).toHaveAttribute('data-level', 'outline');
  // 一節跨兩欄時畫成兩段（羅 1:5 就是）
  await expect(page.getByTestId('mark-bar').first()).toBeVisible();
  await page.getByTestId('zoom-out').click();
  await expect(reader).toHaveAttribute('data-level', 'book');
  const bar = page.getByTestId('mark-bar').first();
  await expect(bar).toBeVisible();
  expect((await bar.boundingBox())!.width).toBeGreaterThanOrEqual(4);
});

test('進度條上有記號點；拖到記號放開，停在那一節', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  // 從搜尋結果到羅 8:28，做記號
  await search(page, '萬事都互相效力');
  const i = (await resultRefs(page)).findIndex((r) => overlaps(r, [45, 8, 28, 28]));
  await page.getByTestId('result').nth(i).getByTestId('open-in-reader').click();
  await verse(page, '45:8:28').locator('.verseNum').click();
  await expect(verse(page, '45:8:28')).toHaveAttribute('data-marked', 'true');
  const dot = page.getByTestId('scrub-mark');
  await expect(dot).toHaveCount(1);
  // 先拖回書首，再拖到記號點
  const track = (await page.getByTestId('reader-scrub').boundingBox())!;
  const d = (await dot.boundingBox())!;
  await page.mouse.move(d.x + d.width / 2, track.y + track.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + 2, track.y + track.height / 2, { steps: 8 });
  await page.mouse.move(d.x + d.width / 2, track.y + track.height / 2, { steps: 12 });
  await page.mouse.up();
  const reader = page.getByTestId('reader');
  await expect(reader).toHaveAttribute('data-level', 'reading');
  await expect(verse(page, '45:8:28')).toBeInViewport();
});
