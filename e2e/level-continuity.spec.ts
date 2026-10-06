// 正典層（焦點樹）↔ 書卷層（章節地圖）的連續性：同樣的章號格語言、常駐的正典帶、章號從一層飛到另一層
import { expect, test } from '@playwright/test';
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
  test('從正典層放大到書卷層：章號從章號格飛到對應的列（過場層出現且帶 16 個章號）', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitReady(page, false);
    await openReader(page);
    const reader = page.getByTestId('reader');
    for (let i = 0; i < 3; i++) {
      await page.getByTestId('zoom-out').click();
      await page.waitForTimeout(700);
    }
    for (let i = 0; i < 4 && (await reader.getAttribute('data-canon-style')) !== 'tree'; i++) await page.getByTestId('canonstyle-toggle').click();
    await expect(page.getByTestId('canon-tree')).toBeVisible();
    await page.getByTestId('zoom-in').click();
    const morph = page.getByTestId('level-morph');
    await expect(morph).toBeVisible();
    await expect(morph.locator('[data-testid="morph-chip"]')).toHaveCount(16);
    await expect(morph).toHaveCount(0, { timeout: 3000 });
    await expect(reader).toHaveAttribute('data-level', 'book');
  });
});
