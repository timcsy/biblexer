// US6：首次載入後完全離線可用（SC-002）。不使用 route()；以關閉伺服器＋離線模式驗證。
import { spawn, type ChildProcess } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { resultRefs, search } from './helpers.ts';

// 自己啟動的預覽伺服器：主預覽埠號＋7（預設 4180），永遠不會與 E2E_PORT 衝突——
// 曾因兩者都用 4180，自己的伺服器起不來卻連到主預覽，「關閉伺服器」沒有真的發生
const PORT = Number(process.env.E2E_PORT ?? 4173) + 7;
const ORIGIN = `http://localhost:${PORT}`;

async function startServer(): Promise<ChildProcess> {
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(ORIGIN)).ok) return p;
    } catch {
      /* 尚未啟動 */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('preview server 未啟動');
}

test('暖機後關閉伺服器並離線：重新載入後搜尋、展開全章、篩選都可用', async ({ page, context }) => {
  const server = await startServer();
  try {
    await page.goto(ORIGIN);
    await expect(page.getByTestId('offline-ready')).toBeVisible({ timeout: 180_000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect(page.getByTestId('status-semantic-ready')).toBeVisible({ timeout: 120_000 });
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  } finally {
    server.kill();
  }
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('status-semantic-ready')).toBeVisible({ timeout: 120_000 });
  await search(page, '應當一無掛慮');
  expect((await resultRefs(page)).length).toBeGreaterThan(0);
  await page.getByTestId('result').first().getByTestId('expand-chapter').click();
  await expect(page.getByTestId('chapter-view')).toBeVisible();
  await page.getByTestId('chapter-close').click();
  await page.getByTestId('filter-NT').click();
  await expect(page.getByTestId('results')).toHaveAttribute('data-filter', 'NT');
});
