// 守護：spec 003 US1～US3、FR-001～FR-011、SC-002、SC-003
import { expect, test, type Page } from '@playwright/test';
import { openReader, search, waitReady } from './helpers.ts';

const startsOf = (page: Page) => page.getByTestId('card-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-start')));

test('加入、去重、整理、保留：重新整理後內容與順序不變', async ({ page }) => {
  await waitReady(page, false);
  await search(page, '麥基洗德');
  const adds = page.getByTestId('add-to-card');
  for (let i = 0; i < 3; i++) await adds.nth(i).click();
  await expect(page.getByTestId('card-toggle')).toContainText('3');
  // 已加入：按鈕停用，不重複加入
  await expect(adds.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(adds.first()).toBeDisabled();

  await page.getByTestId('card-toggle').click();
  const panel = page.getByTestId('card-panel');
  await expect(panel.getByTestId('card-item')).toHaveCount(3);
  const before = await startsOf(page);
  await panel.getByTestId('card-up').nth(2).click();
  expect(await startsOf(page)).toEqual([before[0], before[2], before[1]]);
  await panel.getByTestId('card-remove').nth(0).click();
  expect(await startsOf(page)).toEqual([before[2], before[1]]);

  await page.reload();
  await expect(page.getByTestId('status-keyword-ready')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('card-toggle')).toContainText('2');
  await page.getByTestId('card-toggle').click();
  expect(await startsOf(page)).toEqual([before[2], before[1]]);

  // 清空要再確認一次
  await page.getByTestId('card-clear').click();
  await expect(page.getByTestId('card-item')).toHaveCount(2);
  await page.getByTestId('card-clear-confirm').click();
  await expect(page.getByTestId('card-item')).toHaveCount(0);
  await expect(page.getByTestId('card-print')).toBeDisabled();
});

test('列印頁只含經文、出處、範圍標籤與署名；有書寫欄位；沒有操作介面', async ({ page }) => {
  await waitReady(page, false);
  await search(page, '麥基洗德');
  await page.getByTestId('add-to-card').nth(0).click();
  await page.getByTestId('add-to-card').nth(1).click();
  await page.emulateMedia({ media: 'print' });
  const sheet = page.getByTestId('print-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId('search-input')).toBeHidden();
  await expect(page.getByTestId('card-toggle')).toBeHidden();
  await expect(sheet.getByTestId('write-lines')).toHaveCount(2);
  await expect(sheet.locator('[data-kind="attribution"]')).toContainText('和合本');
  await expect(sheet.locator('[data-kind="attribution"]')).toContainText('新標點和合本');
  // 白名單：每個非空白文字節點都必須在 data-kind 為 text／note／vnum／ref／attribution 的元素內
  const stray = await sheet.evaluate((root) => {
    const allowed = new Set(['text', 'note', 'vnum', 'ref', 'attribution']);
    const out: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const kind = (n.parentElement?.closest('[data-kind]') as HTMLElement | null)?.dataset.kind;
      if (!kind || !allowed.has(kind)) out.push(n.textContent.trim());
    }
    return out;
  });
  expect(stray).toEqual([]);
  // 經文本身確實印出
  await expect(sheet.locator('[data-kind="text"]').first()).not.toBeEmpty();
});

test('「節」檢視加入單節：卡片呈現整個段落並標示這一節', async ({ page }) => {
  await waitReady(page, false);
  await search(page, '麥基洗德');
  await page.getByTestId('granularity-verse').click();
  await expect(page.getByTestId('results')).toHaveAttribute('data-granularity', 'verse');
  await page.getByTestId('add-to-card').first().click();
  await page.getByTestId('card-toggle').click();
  const item = page.getByTestId('card-item').first();
  expect(await item.locator('[data-kind="vnum"]').count()).toBeGreaterThan(1);
  await expect(item.locator('[data-selected="true"]')).toHaveCount(1);
});

test('閱讀器：停在某段按「加入經文卡」→ 卡片出現該段', async ({ page }) => {
  await waitReady(page, false);
  await openReader(page);
  await page.keyboard.press('ArrowDown');
  const landing = (await page.getByTestId('reader').getAttribute('data-landing'))!;
  expect(landing).toMatch(/^para:/);
  await page.getByTestId('reader-add-to-card').click();
  await page.getByTestId('reader-back').click();
  await expect(page.getByTestId('card-toggle')).toContainText('1');
  await page.getByTestId('card-toggle').click();
  await expect(page.getByTestId('card-item')).toHaveCount(1);
  await expect(page.getByTestId('card-item').first()).toHaveAttribute('data-start', /^45:1:/);
});
