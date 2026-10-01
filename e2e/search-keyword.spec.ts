// US2：人名、地名、出處、簡體輸入（spec FR-004～006）
import { expect, test } from '@playwright/test';
import { overlaps, resultRefs, search, waitReady } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await waitReady(page);
});

test('關鍵字查詢：迦拿的婚宴／麥基洗德／大衛打敗巨人歌利亞 命中前 5 筆', async ({ page }) => {
  for (const [q, target] of [
    ['迦拿的婚宴', [43, 2, 1, 11]],
    ['麥基洗德', [58, 7, 1, 28]],
    ['大衛打敗巨人歌利亞', [9, 17, 1, 58]],
  ] as const) {
    await search(page, q);
    const top = (await resultRefs(page)).slice(0, 5);
    const alt: [number, number, number, number] = [1, 14, 1, 24];
    expect(top.some((r) => overlaps(r, [...target]) || (q === '麥基洗德' && overlaps(r, alt))), q).toBe(true);
  }
});

test('出處查詢「羅 8:28」為第 1 筆', async ({ page }) => {
  await search(page, '羅 8:28');
  const [first] = await resultRefs(page);
  expect(overlaps(first!, [45, 8, 28, 28])).toBe(true);
});

test('簡體與繁體輸入的結果相同', async ({ page }) => {
  await search(page, '麥基洗德');
  const trad = (await resultRefs(page)).map((r) => r.start.join(':'));
  await search(page, '麦基洗德');
  const simp = (await resultRefs(page)).map((r) => r.start.join(':'));
  expect(simp).toEqual(trad);
});

test('命中字詞有被標示', async ({ page }) => {
  await search(page, '迦拿');
  await expect(page.getByTestId('result').first().locator('mark').first()).toHaveText('迦拿');
});
