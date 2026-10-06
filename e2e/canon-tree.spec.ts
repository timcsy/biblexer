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
