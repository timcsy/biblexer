// US5：依正典分類篩選（FR-015、FR-016）
import { expect, test } from '@playwright/test';
import { resultRefs, search, waitReady } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await waitReady(page);
  await search(page, '信心');
});

test('選「書信」後，每筆結果都來自書信', async ({ page }) => {
  await page.getByTestId('filter-NT:epistles').click();
  await expect(page.getByTestId('results')).toHaveAttribute('data-filter', 'NT:epistles');
  for (const r of await resultRefs(page)) expect(r.category).toBe('epistles');
});

test('選「舊約」後，每筆結果都來自舊約，且可再細分類別', async ({ page }) => {
  await page.getByTestId('filter-OT').click();
  await expect(page.getByTestId('results')).toHaveAttribute('data-filter', 'OT');
  for (const r of await resultRefs(page)) expect(r.testament).toBe('OT');
  await page.getByTestId('filter-OT:wisdom').click();
  await expect(page.getByTestId('results')).toHaveAttribute('data-filter', 'OT:wisdom');
  for (const r of await resultRefs(page)) expect(r.category).toBe('wisdom');
});

test('數量標示：各約數量等於其類別數量之和', async ({ page }) => {
  const n = async (id: string) => Number((await page.getByTestId(`count-${id}`).innerText()).replace(/\D/g, '') || 0);
  const ot = await n('OT');
  const sum = (await Promise.all(['law', 'history', 'wisdom', 'prophets'].map((c) => n(`OT:${c}`)))).reduce((a, b) => a + b, 0);
  expect(ot).toBe(sum);
});

test('沒有結果時顯示中性訊息並可清除篩選', async ({ page }) => {
  await search(page, '迦拿的婚宴');
  await page.getByTestId('filter-NT:revelation').click();
  await expect(page.getByTestId('filter-empty')).toHaveText('此分類沒有相關段落');
  await page.getByTestId('filter-clear').click();
  await expect(page.getByTestId('result').first()).toBeVisible();
});
