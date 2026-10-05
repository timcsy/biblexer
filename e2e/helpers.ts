import { expect, type Page } from '@playwright/test';

export interface ResultRef {
  start: [number, number, number];
  end: [number, number, number];
  testament: string;
  category: string;
}

export async function waitReady(page: Page, semantic = true): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId(semantic ? 'status-semantic-ready' : 'status-keyword-ready')).toBeVisible({ timeout: 120_000 });
}

export async function search(page: Page, q: string): Promise<void> {
  const input = page.getByTestId('search-input');
  await input.fill(q);
  await input.press('Enter');
  await expect(page.getByTestId('results')).toHaveAttribute('data-query', q, { timeout: 30_000 });
}

const parse = (s: string | null) => (s ?? '0:0:0').split(':').map(Number) as [number, number, number];

export async function resultRefs(page: Page): Promise<ResultRef[]> {
  return page.getByTestId('result').evaluateAll((els) =>
    els.map((e) => ({
      start: e.getAttribute('data-start'),
      end: e.getAttribute('data-end'),
      testament: e.getAttribute('data-testament') ?? '',
      category: e.getAttribute('data-category') ?? '',
    })),
  ).then((rs) => rs.map((r) => ({ ...r, start: parse(r.start), end: parse(r.end) })));
}

/** 結果範圍與 [book, chapter, fromVerse, toVerse] 是否重疊 */
export const overlaps = (r: ResultRef, [b, c, v1, v2]: [number, number, number, number]): boolean => {
  const key = (x: [number, number, number]) => x[0] * 1e6 + x[1] * 1e3 + x[2];
  return key(r.start) <= b * 1e6 + c * 1e3 + v2 && b * 1e6 + c * 1e3 + v1 <= key(r.end);
};

/** 清除 BibLexer 自己的資料快取（模擬瀏覽器清除儲存空間） */
export async function clearDataCaches(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (const k of await caches.keys()) if (k.startsWith('biblexer-')) await caches.delete(k);
  });
}

/** 從首頁開啟閱讀器（羅馬書） */
export async function openReader(page: Page): Promise<void> {
  await page.getByTestId('open-reader').click();
  await expect(page.getByTestId('reader')).toBeVisible();
  await expect(page.getByTestId('verse').first()).toBeVisible({ timeout: 30_000 });
}

/** 逐「框」（手機一欄、桌機一頁）往後翻，讀出全部經節的 data-pos */
export async function collectVersePositions(page: Page, max = 200): Promise<Map<string, string>> {
  const reader = page.getByTestId('reader');
  const seen = new Map<string, string>();
  for (let i = 0; i < max; i++) {
    const pairs = await reader.getByTestId('verse').evaluateAll((els) => els.map((e) => [e.getAttribute('data-ref')!, e.getAttribute('data-pos')!] as const));
    for (const [r, p] of pairs) seen.set(r, p);
    const before = await reader.getAttribute('data-focus');
    await page.keyboard.press('PageDown');
    const after = await reader.getAttribute('data-focus');
    if (after === before) {
      // 等待一下再確認是否真的到底
      await page.waitForTimeout(100);
      if ((await reader.getAttribute('data-focus')) === before) break;
    }
  }
  return seen;
}
