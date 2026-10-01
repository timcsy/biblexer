// US6：查詢不離開裝置（SC-003）——所有請求同源，且沒有任何請求帶有查詢內容
import { expect, test } from '@playwright/test';
import { search, waitReady } from './helpers.ts';

test('搜尋「以馬內利測試」期間，所有請求同源且不含查詢字串', async ({ page, context, baseURL }) => {
  const seen: Array<{ url: string; post: string; headers: string }> = [];
  const sockets: string[] = [];
  context.on('request', (r) => seen.push({ url: r.url(), post: r.postData() ?? '', headers: JSON.stringify(r.headers()) }));
  page.on('websocket', (ws) => sockets.push(ws.url()));

  await waitReady(page);
  const q = '以馬內利測試';
  await search(page, q);
  await search(page, '以马内利测试');

  const origin = new URL(baseURL!).origin;
  const foreign = seen.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  expect(foreign.map((r) => r.url)).toEqual([]);
  expect(sockets).toEqual([]);
  const needles = [q, encodeURIComponent(q), '以马内利测试', encodeURIComponent('以马内利测试'), '以馬內利', '以马内利'];
  const leaks = seen.filter((r) => needles.some((n) => r.url.includes(n) || r.post.includes(n) || r.headers.includes(n)));
  expect(leaks.map((r) => r.url)).toEqual([]);
});
