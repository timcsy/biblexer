// US4：展開全章（FR-010）
import { expect, test } from '@playwright/test';
import { search, waitReady } from './helpers.ts';

test('展開全章：顯示整章、命中段落有標示且在視窗中；可收合', async ({ page }) => {
  await waitReady(page);
  await search(page, '應當一無掛慮，只要凡事藉著禱告');
  const first = page.getByTestId('result').first();
  const label = await first.getByTestId('result-label').innerText();
  await first.getByTestId('expand-chapter').click();
  const view = page.getByTestId('chapter-view');
  await expect(view).toBeVisible();
  const chapter = label.match(/^(.+) (\d+):/)!;
  await expect(view.getByTestId('chapter-title')).toHaveText(`${chapter[1]} ${chapter[2]}`);
  const hits = view.locator('[data-hit="true"]');
  await expect(hits.first()).toBeInViewport();
  expect(await view.locator('.verse').count()).toBeGreaterThan(await hits.count());
  await view.getByTestId('chapter-close').click();
  await expect(page.getByTestId('chapter-view')).toHaveCount(0);
  await expect(page.getByTestId('result').first()).toBeVisible();
});
