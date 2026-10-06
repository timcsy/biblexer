// 一層一層下去（使用者回饋 2026-10-06）：點章號時，書卷 → 章 → 段落 → 頁面，每一層都停一下讓人看清楚
import { expect, test, type Page } from '@playwright/test';
import { openReader, waitReady } from './helpers.ts';

test.use({ reducedMotion: 'no-preference' });

/** 在頁面裡記錄每一次著陸（飛行途中著陸點是空的，不記） */
const recordLandings = (page: Page) =>
  page.getByTestId('reader').evaluate((r) => {
    const log: string[] = [];
    (window as unknown as { landings: string[] }).landings = log;
    new MutationObserver(() => {
      const at = r.getAttribute('data-landing');
      const entry = `${r.getAttribute('data-level')} ${at}`;
      if (at && log.at(-1) !== entry) log.push(entry);
    }).observe(r, { attributes: true, attributeFilter: ['data-landing', 'data-level'] });
  });
const landings = (page: Page) => page.evaluate(() => (window as unknown as { landings: string[] }).landings);

const toTree = async (page: Page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  if ((await reader.getAttribute('data-book-style')) !== 'map') await page.getByTestId('bookstyle-toggle').click();
  for (const level of ['outline', 'book', 'canon']) {
    await page.getByTestId('zoom-out').click();
    await expect(reader).toHaveAttribute('data-level', level, { timeout: 4000 });
    await expect(reader).not.toHaveAttribute('data-landing', '', { timeout: 4000 });
  }
  for (let i = 0; i < 4 && (await reader.getAttribute('data-canon-style')) !== 'tree'; i++) await page.getByTestId('canonstyle-toggle').click();
  await expect(page.getByTestId('canon-tree')).toHaveAttribute('data-phase', 'idle');
};

test('從樹上點羅馬書第 8 章：依序停在 書卷層第 8 章 → 那一段的輪廓 → 精讀', async ({ page }) => {
  await toTree(page);
  await recordLandings(page);
  await page.locator('[data-testid="tree-chapter"][data-book="45"][data-chapter="8"]').click();
  const reader = page.getByTestId('reader');
  await expect(reader).toHaveAttribute('data-level', 'reading', { timeout: 12000 });
  await expect(reader).not.toHaveAttribute('data-landing', '', { timeout: 4000 });
  await expect(page.getByTestId('level-morph')).toHaveCount(0);
  const log = await landings(page);
  const stops = log.filter((e) => !e.startsWith('canon'));
  expect(stops[0]).toBe('book chapter:45:8');
  expect(stops[1]).toMatch(/^outline para:\d+$/);
  expect(stops[2]).toBe(`reading ${stops[1]!.split(' ')[1]}`);
  await expect(page.locator('[data-testid="verse"][data-ref="45:8:1"]')).toBeInViewport();
});

test('從書卷層點章號：只走剩下的——那一段的輪廓 → 精讀', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  if ((await reader.getAttribute('data-book-style')) !== 'map') await page.getByTestId('bookstyle-toggle').click();
  for (const level of ['outline', 'book']) {
    await page.getByTestId('zoom-out').click();
    await expect(reader).toHaveAttribute('data-level', level, { timeout: 4000 });
    await expect(reader).not.toHaveAttribute('data-landing', '', { timeout: 4000 });
  }
  await recordLandings(page);
  await page.locator('[data-testid="book-chapter"][data-chapter="5"]').click();
  await expect(reader).toHaveAttribute('data-level', 'reading', { timeout: 8000 });
  await expect(reader).not.toHaveAttribute('data-landing', '', { timeout: 4000 });
  const log = await landings(page);
  expect(log[0]).toMatch(/^outline para:\d+$/);
  expect(log[1]).toBe(`reading ${log[0]!.split(' ')[1]}`);
});

test('下降途中按任何鍵：直接跳到終點（精讀那一段）', async ({ page }) => {
  await toTree(page);
  await page.locator('[data-testid="tree-chapter"][data-book="45"][data-chapter="8"]').click();
  await page.waitForTimeout(400);
  await page.keyboard.press('ArrowDown');
  const reader = page.getByTestId('reader');
  await expect(reader).toHaveAttribute('data-level', 'reading', { timeout: 500 });
  await expect(page.locator('[data-testid="verse"][data-ref="45:8:1"]')).toBeInViewport();
});
