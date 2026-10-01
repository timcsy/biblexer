// 守護：FR-010、FR-011a（全章展開；合併節顯示為範圍；不含標題）
import { describe, expect, test } from 'vitest';
import { encodePassages, encodeUnits, encodeVerses } from '../../src/core/artifacts.ts';
import { buildKeywordIndex, serializeKeywordIndex } from '../../src/core/bm25.ts';
import { buildUnits } from '../../src/core/passages.ts';
import { createEngine } from '../../src/worker/engine.ts';

const verses = [
  { ref: { book: 1, chapter: 24, verse: 28 }, display: '女子跑回去', notes: [], merged: false, variant: false },
  { ref: { book: 1, chapter: 24, verse: 29 }, display: '利百加有一個哥哥', notes: [], merged: false, variant: false },
  { ref: { book: 1, chapter: 24, verse: 30 }, display: '', notes: [], merged: true, variant: false },
  { ref: { book: 1, chapter: 24, verse: 31 }, display: '便對他說', notes: [], merged: false, variant: false },
  { ref: { book: 1, chapter: 25, verse: 1 }, display: '亞伯拉罕又娶了一妻', notes: [], merged: false, variant: false },
];
const passages = [
  { id: 0, start: 0, end: 0, segmentation: 's' },
  { id: 1, start: 1, end: 3, segmentation: 's' },
  { id: 2, start: 4, end: 4, segmentation: 's' },
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

describe('全章資料', () => {
  test('回傳該章所有經節與段落起點；不跨到下一章', async () => {
    const e = engineWithData();
    await e.init('/data/manifest.json');
    const view = await e.chapter(1, 24);
    expect(view.label).toBe('創世記 24');
    expect(view.verses.map((v) => v.ref.verse)).toEqual([28, 29, 30, 31]);
    expect(view.passageStarts).toEqual([0, 1]);
  });

  test('合併節：承載節標示 mergedTo，佔位節標為 merged', async () => {
    const e = engineWithData();
    await e.init('/data/manifest.json');
    const view = await e.chapter(1, 24);
    expect(view.verses[1]).toMatchObject({ mergedTo: 30 });
    expect(view.verses[2]).toMatchObject({ merged: true });
  });

  test('經文片段只有經文與譯註，沒有任何標題', async () => {
    const e = engineWithData();
    await e.init('/data/manifest.json');
    const view = await e.chapter(1, 24);
    expect(view.verses.flatMap((v) => v.parts.map((p) => p.value)).join('')).toBe('女子跑回去利百加有一個哥哥便對他說');
  });
});
