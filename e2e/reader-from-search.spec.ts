// US3：從搜尋結果進入閱讀器的對應位置（SC-004、FR-015、FR-016）
import { expect, test } from '@playwright/test';
import { search, waitReady } from './helpers.ts';

test('羅馬書範圍內的結果可在閱讀器中開啟：落在命中段落起點、標示命中；返回後回到原本的結果與捲動位置', async ({ page }) => {
  await waitReady(page);
  await search(page, '萬事都互相效力');
  const results = page.getByTestId('result');
  // 羅馬書以外的結果沒有入口
  for (const r of await results.all()) {
    const start = (await r.getAttribute('data-start'))!;
    await expect(r.getByTestId('open-in-reader')).toHaveCount(start.startsWith('45:') ? 1 : 0);
  }
  const romans = page.locator('[data-testid="result"][data-start^="45:"]').first();
  const start = (await romans.getAttribute('data-start'))!;
  const end = (await romans.getAttribute('data-end'))!;
  await romans.scrollIntoViewIfNeeded();
  const scrollY = await page.evaluate(() => window.scrollY);

  await romans.getByTestId('open-in-reader').click();
  const reader = page.getByTestId('reader');
  await expect(reader).toHaveAttribute('data-level', 'reading');
  await expect(reader).toHaveAttribute('data-focus', /^para:\d+$/);
  // 命中段落的第一節在畫面上、且被標示
  const first = reader.locator(`[data-testid="verse"][data-ref="${start}"]`);
  await expect(first).toHaveAttribute('data-hit', 'true');
  await expect(first).toBeInViewport();
  await expect(reader.locator(`[data-testid="verse"][data-ref="${end}"]`)).toHaveAttribute('data-hit', 'true');
  // 命中範圍以外的經節沒有標示
  const outside = await reader.locator('[data-testid="verse"][data-hit="false"]').count();
  expect(outside).toBeGreaterThan(0);

  await page.getByTestId('reader-back').click();
  await expect(reader).toHaveCount(0);
  await expect(page.getByTestId('results')).toHaveAttribute('data-query', '萬事都互相效力');
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollY)).toBeLessThan(2);
});
