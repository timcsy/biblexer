// 原型第三版：正典的焦點樹——熟悉的樹形，焦點那一枝展開、其他收攏；點類別換焦點、點章號進入
import { expect, test } from '@playwright/test';
import { openReader, waitReady } from './helpers.ts';

test('焦點樹：羅馬書在書信下展開各章；律法書收成一行；點律法書換焦點；點創世記第 3 章進入', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-out').click();
  await expect(reader).toHaveAttribute('data-level', 'canon');
  if ((await reader.getAttribute('data-canon-style')) !== 'tree') await page.getByTestId('canonstyle-toggle').click();
  const tree = page.getByTestId('canon-tree');
  await expect(tree).toHaveAttribute('data-focus-book', '45');
  await expect(page.getByTestId('tree-hint')).toContainText('點類別');
  await expect(page.getByTestId('canon-category-attribution')).toContainText('分類');
  await expect(tree.getByTestId('tree-chapter')).toHaveCount(16);
  await expect(tree.locator('[data-testid="tree-book"][data-book="1"]')).toHaveCount(0);
  const law = tree.locator('[data-testid="tree-category"][data-id="c:OT:law"]');
  await expect(law).toContainText('5 卷');
  await law.click();
  await expect(tree).toHaveAttribute('data-focus-book', '1');
  await expect(reader).toHaveAttribute('data-landing', 'book:1');
  await expect(tree.getByTestId('tree-chapter')).toHaveCount(50);
  await tree.locator('[data-testid="tree-chapter"][data-book="1"][data-chapter="3"]').click();
  await expect(page.getByTestId('reader-title')).toHaveText('創世記');
  await expect(page.locator('[data-testid="verse"][data-ref="1:3:1"]')).toBeInViewport();
});

test('第五版：正典帶標出目前位置、點一段換焦點；收起的類別顯示份量；焦點路徑高亮', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-out').click();
  for (let i = 0; i < 4 && (await reader.getAttribute('data-canon-style')) !== 'tree'; i++) await page.getByTestId('canonstyle-toggle').click();
  const strip = page.getByTestId('canon-strip');
  await expect(strip.getByTestId('strip-seg')).toHaveCount(66);
  await expect(strip.locator('[data-testid="strip-seg"][data-book="45"]')).toHaveAttribute('aria-current', 'location');
  const law = page.locator('[data-testid="tree-category"][data-id="c:OT:law"]');
  await expect(law).toContainText('5 卷／187 章');
  await expect(law.getByTestId('size-bar')).toBeVisible();
  expect(await page.getByTestId('tree-path').count()).toBeGreaterThanOrEqual(3);
  await strip.locator('[data-testid="strip-seg"][data-book="1"]').click();
  await expect(page.getByTestId('canon-tree')).toHaveAttribute('data-focus-book', '1');
  await expect(strip.locator('[data-testid="strip-seg"][data-book="1"]')).toHaveAttribute('aria-current', 'location');
});

test('操作順手：在樹上捲動是捲動樹本身（不移動背後的閱讀器）；提示不遮住節點；點目前書卷進入閱讀', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-out').click();
  for (let i = 0; i < 4 && (await reader.getAttribute('data-canon-style')) !== 'tree'; i++) await page.getByTestId('canonstyle-toggle').click();
  const landing = await reader.getAttribute('data-landing');
  const wrap = page.getByTestId('canon-tree-scroll');
  const box = (await wrap.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => wrap.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  await expect(reader).toHaveAttribute('data-level', 'canon');
  await expect(reader).toHaveAttribute('data-landing', landing!);
  // 在樹上拖曳也不移動背後的閱讀器
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + 300, { steps: 6 });
  await page.mouse.up();
  await expect(reader).toHaveAttribute('data-landing', landing!);
  // 提示不與任何節點重疊
  const hint = (await page.getByTestId('tree-hint').boundingBox())!;
  // 只算實際顯示在捲動區內的節點（捲到上方被裁掉的不算）
  const area = (await wrap.boundingBox())!;
  const overlaps = await page.getByTestId('canon-tree').locator('.tree-node').evaluateAll(
    (els, [h, a]) =>
      els.filter((e) => {
        const r = e.getBoundingClientRect();
        const shown = r.bottom > a.y && r.top < a.y + a.height;
        return shown && r.bottom > h.y && r.top < h.y + h.height && r.right > h.x && r.left < h.x + h.width;
      }).length,
    [hint, area] as const,
  );
  expect(overlaps).toBe(0);
  // 點目前的書卷：進入那一卷的書首
  await wrap.evaluate((e) => (e.scrollTop = 0));
  await page.locator('[data-testid="tree-book"][data-book="45"]').click();
  await expect(reader).toHaveAttribute('data-level', 'reading');
  await expect(page.locator('[data-testid="verse"][data-ref="45:1:1"]')).toBeInViewport();
});

test('焦點換到下方的類別時，畫面跟過去（焦點書卷在可見範圍內）', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-out').click();
  for (let i = 0; i < 4 && (await reader.getAttribute('data-canon-style')) !== 'tree'; i++) await page.getByTestId('canonstyle-toggle').click();
  // 瑪拉基書是先知書 17 卷的最後一卷：展開後位在畫面下方
  await page.getByTestId('canon-strip').locator('[data-testid="strip-seg"][data-book="39"]').click();
  await expect(page.locator('[data-testid="tree-book"][data-book="39"]')).toBeInViewport();
});
