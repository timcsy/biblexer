// US1：固定版面——同一節在任何視窗下的頁／欄／行／格相同（SC-001、FR-002～FR-004）
import { expect, test } from '@playwright/test';
import { collectVersePositions, openReader, waitReady } from './helpers.ts';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 900 },
];
const ROMANS_VERSES = 433;

test('三種視窗寬度下，羅馬書 433 節的版面座標完全相同；顯示分段署名', async ({ browser }) => {
  test.setTimeout(600_000);
  const all: Array<Map<string, string>> = [];
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await waitReady(page, false);
    await openReader(page);
    await expect(page.getByTestId('segmentation-attribution')).toContainText('新標點和合本');
    const positions = await collectVersePositions(page);
    expect(positions.size, `${viewport.width}×${viewport.height}`).toBe(ROMANS_VERSES);
    all.push(positions);
    await context.close();
  }
  for (const m of all.slice(1)) expect(Object.fromEntries(m)).toEqual(Object.fromEntries(all[0]!));
});

test('閱讀中改變視窗大小：版面座標不變，仍停在原本的著陸點', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  const focus = await reader.getAttribute('data-focus');
  // 取可見區域內的第一節
  const [ref, pos] = await page.evaluate(() => {
    const vp = document.querySelector('[data-testid="reader-viewport"]')!.getBoundingClientRect();
    const el = [...document.querySelectorAll('[data-testid="verse"]')].find((e) => {
      const r = e.getBoundingClientRect();
      return r.top >= vp.top && r.bottom <= vp.bottom && r.left >= vp.left && r.right <= vp.right;
    })!;
    return [el.getAttribute('data-ref'), el.getAttribute('data-pos')];
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(reader).toHaveAttribute('data-focus', focus!);
  await expect(reader.locator(`[data-testid="verse"][data-ref="${ref}"]`)).toHaveAttribute('data-pos', pos!);
});
