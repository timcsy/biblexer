// 守護：spec 004 FR-001～FR-005、SC-002、SC-003；vision 階段 3「摺疊比對兩段經文後放開，閱讀位置不變」
import { expect, test } from '@playwright/test';
import { openReader, waitReady } from './helpers.ts';

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
  const items = panel.getByTestId('parallel-item');
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
