// 守護：contracts/reader-api.md §2（閱讀器取得一整卷的經節與段落起點；不含標題）
import { describe, expect, test } from 'vitest';
import { encodePassages, encodeUnits, encodeVerses } from '../../src/core/artifacts.ts';
import { buildKeywordIndex, serializeKeywordIndex } from '../../src/core/bm25.ts';
import { buildUnits } from '../../src/core/passages.ts';
import { createEngine } from '../../src/worker/engine.ts';

const v = (book: number, chapter: number, verse: number, display: string, merged = false) => ({ ref: { book, chapter, verse }, display, notes: [], merged, variant: false });
const verses = [
  v(44, 28, 31, '放膽傳講神國的道'),
  v(45, 1, 1, '耶穌基督的僕人保羅'),
  v(45, 1, 2, '這福音是神從前藉眾先知'),
  v(45, 1, 3, ''),
  v(45, 2, 1, '你這論斷人的'),
  v(46, 1, 1, '奉神旨意'),
];
// 第 3 節為合併佔位：把第 2 節標成承載節
verses[3] = v(45, 1, 3, '', true);
const passages = [
  { id: 0, start: 0, end: 0, segmentation: 's' },
  { id: 1, start: 1, end: 1, segmentation: 's' },
  { id: 2, start: 2, end: 3, segmentation: 's' },
  { id: 3, start: 4, end: 4, segmentation: 's' },
  { id: 4, start: 5, end: 5, segmentation: 's' },
];
const units = buildUnits(passages, { skipVerse: (i) => verses[i]!.merged });

function engineWithData() {
  const files: Record<string, Uint8Array> = {
    'verses.json': new TextEncoder().encode(encodeVerses(verses)),
    'passages.bin': encodePassages(passages),
    'units.bin': encodeUnits(units),
    'keyword.bin': serializeKeywordIndex(buildKeywordIndex(units.filter((u) => u.scale === 'verse').map((u) => verses[u.start]!.display))),
  };
  const manifest = { files: Object.fromEntries(['verses', 'passages', 'units', 'keyword'].map((k) => [k, { path: Object.keys(files).find((f) => f.startsWith(k))!, bytes: 0 }])) };
  files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
  return createEngine({
    fetchBytes: async (url) => files[url.split('/').pop()!]!,
    loadEmbedder: async () => {
      throw new Error('no model');
    },
  });
}

describe('整卷資料', () => {
  test('只回傳該卷的經節（含合併佔位節）；段落起點為相對索引', async () => {
    const e = engineWithData();
    await e.init('/data/manifest.json', undefined, false);
    const data = await e.book(45);
    expect(data.book).toBe(45);
    expect(data.verses.map((x) => `${x.ref.chapter}:${x.ref.verse}`)).toEqual(['1:1', '1:2', '1:3', '2:1']);
    expect(data.paragraphStarts).toEqual([0, 1, 3]);
  });

  test('合併節：承載節有 mergedTo，佔位節 merged', async () => {
    const e = engineWithData();
    await e.init('/data/manifest.json', undefined, false);
    const data = await e.book(45);
    expect(data.verses[1]).toMatchObject({ mergedTo: 3 });
    expect(data.verses[2]).toMatchObject({ merged: true });
  });

  test('經文只有經文與譯註，沒有任何標題', async () => {
    const e = engineWithData();
    await e.init('/data/manifest.json', undefined, false);
    const data = await e.book(45);
    expect(data.verses.flatMap((x) => x.parts.map((p) => p.value)).join('')).toBe('耶穌基督的僕人保羅這福音是神從前藉眾先知你這論斷人的');
  });

  test('未載入資料時回報 NOT_DOWNLOADED', async () => {
    await expect(engineWithData().book(45)).rejects.toMatchObject({ code: 'NOT_DOWNLOADED' });
  });
});

describe('經文卡（spec 003）', () => {
  test('依經文位置取出所在段落，所選經節標為 inResult；找不到的回傳 null', async () => {
    const e = engineWithData();
    await e.init('/data/manifest.json', undefined, false);
    const [a, b] = await e.card([
      { start: [45, 1, 2], end: [45, 1, 2] },
      { start: [45, 9, 1], end: [45, 9, 1] },
    ]);
    // 1:3 合併在 1:2 裡（和合本「2–3」）：選 1:2 即包含 1:3
    expect(a).toMatchObject({ label: '羅馬書 1:2–3', contextLabel: null, start: [45, 1, 2], end: [45, 1, 2] });
    expect(a!.verses.map((x) => [x.ref.verse, x.inResult])).toEqual([
      [2, true],
      [3, true],
    ]);
    expect(b).toBeNull();
  });
});
