// 守護：spec 004 FR-001～FR-005、SC-002、SC-003；vision 階段 3「摺疊比對兩段經文後放開，閱讀位置不變」
import { expect, test } from '@playwright/test';
import { openReader, overlaps, resultRefs, search, waitReady } from './helpers.ts';

test('串珠：列出不同章的可能相關段落、無分數；原位展開比對；關閉後閱讀位置不變', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page);
  await openReader(page);
  const reader = page.getByTestId('reader');
  await page.keyboard.press('ArrowDown');
  const landing = (await reader.getAttribute('data-landing'))!;
  expect(landing).toMatch(/^para:/);
  const transform = await page.locator('.world').getAttribute('style');

  await page.getByTestId('reader-parallels').click();
  const panel = page.getByTestId('parallels-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-source', landing);
  // FR-001 的「不含同一章」只適用語意近鄰；明引與 TSK 的參照可以在同一章
  const items = panel.locator('[data-testid="parallel-item"][data-tier="semantic"]');
  await expect(items.first()).toBeVisible({ timeout: 30_000 });
  expect(await items.count()).toBeGreaterThan(0);
  // 不含同一章（目前在第 1 章）
  for (const s of await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-start')!))) expect(s.startsWith('45:1:')).toBe(false);
  // 無分數、無權威字眼
  const text = await panel.innerText();
  expect(text).not.toMatch(/%|分數|推薦|最佳/);
  await expect(panel.getByTestId('parallels-basis')).toContainText('語意');

  // 原位展開比對
  await items.first().getByTestId('parallel-open').click();
  const open = panel.getByTestId('parallel-expanded');
  await expect(open).toBeVisible();
  const before = await open.locator('[data-kind="vnum"]').count();
  expect(before).toBeGreaterThan(0);
  await open.getByTestId('parallel-expand-chapter').click();
  await expect.poll(() => open.locator('[data-kind="vnum"]').count()).toBeGreaterThan(before);

  // 閱讀器沒有移動
  await expect(reader).toHaveAttribute('data-landing', landing);
  expect(await page.locator('.world').getAttribute('style')).toBe(transform);
  await page.getByTestId('parallels-close').click();
  await expect(panel).toHaveCount(0);
  await expect(reader).toHaveAttribute('data-landing', landing);
  expect(await page.locator('.world').getAttribute('style')).toBe(transform);
});

test('串珠面板開著時換段：清單跟著更新', async ({ page }) => {
  await waitReady(page);
  await openReader(page);
  const reader = page.getByTestId('reader');
  await page.keyboard.press('ArrowDown');
  await page.getByTestId('reader-parallels').click();
  const panel = page.getByTestId('parallels-panel');
  await expect(panel.getByTestId('parallel-item').first()).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('ArrowDown');
  const landing = (await reader.getAttribute('data-landing'))!;
  await expect(panel).toHaveAttribute('data-source', landing);
});

// ── 經文本身的關聯：新約引用舊約（UBS 明引）、TSK（spec 004 User Story 3、FR-007～FR-013）──
const openParallelsAt = async (page: import('@playwright/test').Page, query: string, ref: string) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // 只等關鍵字檢索：明引與 TSK 不依賴語意模型（FR-013）
  await waitReady(page, false);
  await search(page, query);
  // 結果以段落為單位：找範圍涵蓋這一節的那一筆
  const [b, c, v] = ref.split(':').map(Number) as [number, number, number];
  const i = (await resultRefs(page)).findIndex((r) => overlaps(r, [b, c, v, v]));
  expect(i, `搜尋「${query}」的結果中要有 ${ref}`).toBeGreaterThanOrEqual(0);
  await page.getByTestId('result').nth(i).getByTestId('open-in-reader').click();
  await expect(page.getByTestId('reader')).toBeVisible();
  await page.getByTestId('reader-parallels').click();
  return page.getByTestId('parallels-panel');
};

test('羅 1:17：第一層「新約引用舊約」列出哈 2:4，署名 UBS 與授權；語意未就緒時照常顯示', async ({ page }) => {
  const panel = await openParallelsAt(page, '義人必因信得生', '45:1:17');
  const quote = panel.locator('[data-testid="parallels-layer"][data-tier="quote"]');
  await expect(quote.locator('[data-testid="parallel-item"][data-start="35:2:4"]')).toBeVisible({ timeout: 30_000 });
  await expect(quote.getByTestId('parallels-attribution')).toContainText('UBS Parallel Passages Database');
  await expect(quote.getByTestId('parallels-attribution')).toContainText('CC BY-SA 4.0');
  await expect(quote.getByTestId('parallels-attribution')).toContainText('明引');
  // 層的順序：明引在 TSK 之前
  const tiers = await panel.getByTestId('parallels-layer').evaluateAll((els) => els.map((e) => e.getAttribute('data-tier')));
  expect(tiers.indexOf('quote')).toBeLessThan(tiers.indexOf('tsk'));
});

test('哈 2:4：第一層反過來列出引用它的新約（含羅 1:17）', async ({ page }) => {
  const panel = await openParallelsAt(page, '惟義人因信得生', '35:2:4');
  await expect(panel.locator('[data-testid="parallels-layer"][data-tier="quote"] [data-testid="parallel-item"][data-start="45:1:17"]')).toBeVisible({ timeout: 30_000 });
});

test('羅 8:28：TSK 層含創 50:20、沒有英文分組標題；關閉這一層後重開面板仍關著', async ({ page }) => {
  const panel = await openParallelsAt(page, '萬事都互相效力', '45:8:28');
  const tsk = panel.locator('[data-testid="parallels-layer"][data-tier="tsk"]');
  await expect(tsk.locator('[data-testid="parallel-item"][data-start="1:50:20"]')).toBeVisible({ timeout: 30_000 });
  await expect(tsk.getByTestId('parallels-attribution')).toContainText('Treasury of Scripture Knowledge');
  // 清單本身只有出處與經文：沒有英文（TSK 的英文分組標題、旁註都不取）
  const listText = await tsk.locator('[data-testid="parallel-item"]').allInnerTexts();
  for (const t of listText) expect(t).not.toMatch(/[A-Za-z]{2,}/);
  await tsk.getByTestId('parallels-layer-toggle').click();
  await expect(tsk.getByTestId('parallel-item')).toHaveCount(0);
  await page.getByTestId('parallels-close').click();
  await page.getByTestId('reader-parallels').click();
  const again = page.locator('[data-testid="parallels-layer"][data-tier="tsk"]');
  await expect(again).toBeVisible({ timeout: 30_000 });
  await expect(again.getByTestId('parallel-item')).toHaveCount(0);
  // 其他層不受影響
  await expect(page.locator('[data-testid="parallels-layer"][data-tier="quote"]').or(page.locator('[data-testid="parallels-layer"][data-tier="semantic"]')).first()).toBeVisible();
});
