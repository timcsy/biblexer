// US1：用日常語言找到相關經文段落（spec FR-003、FR-008、FR-012、FR-014、FR-026～029、SC-006）
import { expect, test } from '@playwright/test';
import { overlaps, resultRefs, search, waitReady } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await waitReady(page);
});

test('意思型查詢：神離我很遠 → 詩 88／哀／伯 在前 5 筆', async ({ page }) => {
  await search(page, '覺得神離我很遠，禱告像打在天花板上');
  const top = (await resultRefs(page)).slice(0, 5);
  expect(top.some((r) => overlaps(r, [19, 88, 1, 18]) || r.start[0] === 25 || r.start[0] === 18)).toBe(true);
});

test('換說法：很怕別人怎麼看我 → 箴 29:25／加 1:10／帖前 2:4 在前 5 筆', async ({ page }) => {
  await search(page, '很怕別人怎麼看我，總想讓人喜歡我');
  const top = (await resultRefs(page)).slice(0, 5);
  expect(top.some((r) => overlaps(r, [20, 29, 25, 25]) || overlaps(r, [48, 1, 10, 10]) || overlaps(r, [52, 2, 4, 4]))).toBe(true);
});

test('結果以段落呈現、標示出處與約／類別，沒有分數；標題、署名、換說法提示都在', async ({ page }) => {
  await search(page, '神愛世人');
  await expect(page.getByTestId('results-title')).toHaveText('可能相關的段落');
  const cards = page.getByTestId('result');
  await expect(cards.first()).toBeVisible();
  for (const card of await cards.all()) {
    await expect(card.getByTestId('result-label')).toHaveText(/.+ \d+:\d+/);
    await expect(card.getByTestId('result-category')).toHaveText(/(舊約|新約)・/);
  }
  const text = await page.getByTestId('results').innerText();
  expect(text).not.toMatch(/分數|score|\d\.\d{2,}/i);
  await expect(page.getByTestId('attribution')).toContainText('新標點和合本');
  await expect(page.getByTestId('rephrase-hint')).toContainText('換個說法');
});

test('預設 10 筆，「載入更多」顯示後續且不重複（FR-003）', async ({ page }) => {
  await search(page, '神');
  await expect(page.getByTestId('result')).toHaveCount(10);
  await page.getByTestId('load-more').click();
  await expect(page.getByTestId('result')).toHaveCount(20);
  const refs = (await resultRefs(page)).map((r) => r.start.join(':'));
  expect(new Set(refs).size).toBe(refs.length);
});

test('節／段／章 切換：範圍隨之改變（FR-026）', async ({ page }) => {
  await search(page, '應當一無掛慮');
  await page.getByTestId('granularity-verse').click();
  await expect(page.getByTestId('results')).toHaveAttribute('data-granularity', 'verse');
  for (const r of await resultRefs(page)) expect(r.start).toEqual(r.end);
  await page.getByTestId('granularity-chapter').click();
  await expect(page.getByTestId('results')).toHaveAttribute('data-granularity', 'chapter');
  for (const r of await resultRefs(page)) expect(r.start[2]).toBe(1);
});

test('詞彙擴充：列出「也比對了」與來源，可關閉（FR-027、FR-028）', async ({ page }) => {
  await search(page, '焦慮');
  const note = page.getByTestId('expansion-note');
  await expect(note).toContainText('憂慮');
  await expect(note).toContainText('教育部');
  await page.getByTestId('expansion-toggle').click();
  await expect(page.getByTestId('expansion-note')).toHaveCount(0);
});
