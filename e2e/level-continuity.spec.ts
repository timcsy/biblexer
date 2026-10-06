// 正典層（焦點樹）↔ 書卷層（章節地圖）的連續性：同樣的章號格語言、常駐的正典帶、分段過場「章號格展開成那一章」
import { expect, test, type Page } from '@playwright/test';
import { openReader, waitReady } from './helpers.ts';

test('書卷層的章號與正典層同一種章號格（同類別色）；正典帶在書卷層也常駐', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  await page.getByTestId('zoom-out').click();
  await page.getByTestId('zoom-out').click();
  await expect(reader).toHaveAttribute('data-level', 'book');
  if ((await reader.getAttribute('data-book-style')) !== 'map') await page.getByTestId('bookstyle-toggle').click();
  const ch8 = page.locator('[data-testid="book-chapter"][data-chapter="8"]');
  await expect(ch8).toHaveAttribute('data-palette', 'NT:epistles');
  await expect(page.getByTestId('canon-strip')).toBeVisible();
  await expect(page.getByTestId('canon-strip').locator('[data-testid="strip-seg"][data-book="45"]')).toHaveAttribute('aria-current', 'location');
});

test.describe('有動畫時', () => {
  test.use({ reducedMotion: 'no-preference' });

  const toTree = async (page: Page) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitReady(page, false);
    await openReader(page);
    const reader = page.getByTestId('reader');
    if ((await reader.getAttribute('data-book-style')) !== 'map') await page.getByTestId('bookstyle-toggle').click();
    await page.getByTestId('zoom-out').click();
    await expect(reader).toHaveAttribute('data-level', 'outline');
    await page.waitForTimeout(900);
    await page.getByTestId('zoom-out').click();
    await expect(reader).toHaveAttribute('data-level', 'book');
    await page.waitForTimeout(900);
    // 書卷層 → 正典層（若預設不是樹狀，會走一般的相機飛行；切到樹狀後再測）
    await page.getByTestId('zoom-out').click();
    await expect(reader).toHaveAttribute('data-level', 'canon', { timeout: 3000 });
    await expect(page.getByTestId('level-morph')).toHaveCount(0, { timeout: 3000 });
    for (let i = 0; i < 4 && (await reader.getAttribute('data-canon-style')) !== 'tree'; i++) await page.getByTestId('canonstyle-toggle').click();
    await expect(page.getByTestId('canon-tree')).toBeVisible();
    await page.waitForTimeout(700);
  };

  test('放大：退場 → 章號整組移動 → 展開成那一章；過程中書卷層的章號被過場層取代', async ({ page }) => {
    await toTree(page);
    const reader = page.getByTestId('reader');
    await page.getByTestId('zoom-in').click();
    const morph = page.getByTestId('level-morph');
    await expect(morph).toHaveAttribute('data-phase', 'focus');
    await expect(morph.locator('[data-testid="morph-chip"]')).toHaveCount(16);
    await expect(morph).toHaveAttribute('data-phase', 'move');
    await expect(reader).toHaveAttribute('data-level', 'book');
    await expect(morph).toHaveAttribute('data-phase', 'unfold');
    await expect(morph).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator('[data-testid="book-chapter"][data-chapter="8"]')).toBeVisible();
  });

  test('縮小：完全反向——收回章號格 → 回到樹上；樹的章號格最後出現', async ({ page }) => {
    await toTree(page);
    const reader = page.getByTestId('reader');
    await page.getByTestId('zoom-in').click();
    await expect(page.getByTestId('level-morph')).toHaveCount(0, { timeout: 3000 });
    await page.getByTestId('zoom-out').click();
    const morph = page.getByTestId('level-morph');
    await expect(morph).toHaveAttribute('data-phase', 'fold');
    await expect(morph.locator('[data-testid="morph-chip"]')).toHaveCount(16);
    await expect(morph).toHaveAttribute('data-phase', 'return');
    await expect(reader).toHaveAttribute('data-level', 'canon');
    await expect(morph).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator('[data-testid="tree-chapter"][data-chapter="8"]')).toBeVisible();
  });

  test('手勢一碰就跳到終點', async ({ page }) => {
    await toTree(page);
    await page.getByTestId('zoom-in').click();
    await expect(page.getByTestId('level-morph')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('level-morph')).toHaveCount(0, { timeout: 300 });
    await expect(page.getByTestId('reader')).not.toHaveAttribute('data-level', 'canon');
  });
});
