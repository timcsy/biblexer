// 守護：spec 005（全本閱讀器）
import { expect, test } from '@playwright/test';
import { openReader, search, waitReady } from './helpers.ts';

test('正典層點創世記：開啟創世記書首；標題是書卷名稱', async ({ page }) => {
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-out').click();
  await expect(reader).toHaveAttribute('data-level', 'canon');
  // 這裡測的是方塊檢視（雙曲全貌另見 e2e/hyperbolic.spec.ts）
  if ((await reader.getAttribute('data-canon-style')) === 'hyperbolic') await page.getByTestId('canonstyle-toggle').click();
  // 正典層以目前書卷（羅馬書）為中心；先用方向鍵移到創世記，再點它
  for (let i = 0; i < 44; i++) await page.keyboard.press('ArrowLeft');
  await expect(reader).toHaveAttribute('data-landing', 'book:1');
  await page.locator('[data-testid="canon-book"][data-book="1"]').click();
  await expect(page.getByTestId('reader-title')).toHaveText('創世記');
  await expect(page.getByTestId('reader')).toHaveAttribute('data-level', 'reading');
  await expect(page.locator('[data-testid="verse"][data-ref="1:1:1"]')).toBeInViewport();
});

test('約翰福音的搜尋結果在閱讀器中開啟：停在命中段落並標示', async ({ page }) => {
  await waitReady(page, false);
  await search(page, '迦拿');
  const john = page.locator('[data-testid="result"][data-start^="43:2:"]').first();
  const start = (await john.getAttribute('data-start'))!;
  await john.getByTestId('open-in-reader').click();
  await expect(page.getByTestId('reader-title')).toHaveText('約翰福音');
  const v = page.locator(`[data-testid="verse"][data-ref="${start}"]`);
  await expect(v).toHaveAttribute('data-hit', 'true');
  await expect(v).toBeInViewport();
});

test('路得記：兩種視窗寬度下版面座標相同', async ({ browser }) => {
  const seen: string[] = [];
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await waitReady(page, false);
    await search(page, '路得 1:16');
    await page.locator('[data-testid="result"][data-start^="8:1:"]').first().getByTestId('open-in-reader').click();
    await expect(page.getByTestId('reader-title')).toHaveText('路得記');
    seen.push((await page.locator('[data-testid="verse"][data-ref="8:1:16"]').getAttribute('data-pos'))!);
    await context.close();
  }
  expect(seen[0]).toBe(seen[1]);
});

test('詩篇：進度條保留 150 個刻度，章號標籤不重疊', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await search(page, '詩篇 23');
  await page.locator('[data-testid="result"][data-start^="19:23:"]').first().getByTestId('open-in-reader').click();
  await expect(page.getByTestId('reader-title')).toHaveText('詩篇');
  await expect(page.getByTestId('scrub-tick')).toHaveCount(150);
  const boxes = await page.locator('[data-testid="scrub-tick"] small').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null && getComputedStyle(e).visibility !== 'hidden').map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.right]));
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]![0]!).toBeGreaterThanOrEqual(boxes[i - 1]![1]! - 0.5);
});

test('正典層標明書卷順序的來源（原則 9；草稿第四輪決定 7）', async ({ page }) => {
  await waitReady(page, false);
  await openReader(page);
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-out').click();
  await expect(page.getByTestId('reader')).toHaveAttribute('data-level', 'canon');
  await expect(page.getByTestId('canon-order-attribution')).toContainText('和合本書卷順序');
  // 其他層級不顯示
  await page.getByTestId('zoom-in').click();
  await expect(page.getByTestId('canon-order-attribution')).toHaveCount(0);
});
