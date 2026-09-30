// 守護：建置產物完整性（npm run test:data，須在 npm run build:data 之後執行）
// research R1、R2；FR-007；FR-011a；data-model Passage 規則
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { decodePassages, decodeUnits, decodeVerses } from '../../src/core/artifacts.ts';
import { VARIANT_VERSES } from '../../scripts/lib/fhl.ts';

const dataDir = join(import.meta.dirname, '../../public/data');
type Manifest = {
  segmentation: { id: string };
  files: Record<string, { path: string; bytes: number }>;
};
let manifest: Manifest;
const read = (key: string) => readFileSync(join(dataDir, manifest.files[key]!.path));

beforeAll(() => {
  manifest = JSON.parse(readFileSync(join(dataDir, 'manifest.json'), 'utf8')) as Manifest;
});

describe('建置產物', () => {
  test('66 卷、1,189 章、31,103 節', () => {
    const books = JSON.parse(read('books').toString('utf8')) as unknown[];
    expect(books).toHaveLength(66);
    const verses = decodeVerses(read('verses').toString('utf8'));
    expect(verses).toHaveLength(31103);
    expect(new Set(verses.map((v) => `${v.ref.book}:${v.ref.chapter}`)).size).toBe(1189);
  });

  test('71 個合併節皆承接同章前一節；11 節異文皆有標記', () => {
    const verses = decodeVerses(read('verses').toString('utf8'));
    const merged = verses.map((v, i) => ({ v, i })).filter(({ v }) => v.merged);
    expect(merged).toHaveLength(71);
    for (const { i } of merged) {
      const prev = verses[i - 1]!;
      expect(prev.ref.chapter).toBe(verses[i]!.ref.chapter);
      expect(prev.ref.book).toBe(verses[i]!.ref.book);
    }
    expect(verses.filter((v) => v.variant)).toHaveLength(VARIANT_VERSES.length);
  });

  test('每節恰屬一段；異文經節與前一節同段', () => {
    const verses = decodeVerses(read('verses').toString('utf8'));
    const passages = decodePassages(read('passages'));
    const owner = new Int32Array(verses.length).fill(-1);
    passages.forEach((p, id) => {
      for (let i = p.start; i <= p.end; i++) {
        expect(owner[i]).toBe(-1);
        owner[i] = id;
      }
    });
    expect(Array.from(owner).every((o) => o >= 0)).toBe(true);
    verses.forEach((v, i) => {
      if (v.variant) expect(owner[i]).toBe(owner[i - 1]);
    });
  });

  test('檢索單元都落在所屬段落內', () => {
    const passages = decodePassages(read('passages'));
    for (const u of decodeUnits(read('units'))) {
      const p = passages[u.passageId]!;
      expect(u.start).toBeGreaterThanOrEqual(p.start);
      expect(u.end).toBeLessThanOrEqual(p.end);
    }
  });

  test('不含段落標題；經文保留神版抬頭空白', () => {
    expect(manifest.segmentation.id).toBe('cu89-paragraphs');
    const verses = decodeVerses(read('verses').toString('utf8'));
    const john11 = verses.find((v) => v.ref.book === 43 && v.ref.chapter === 1 && v.ref.verse === 1)!;
    expect(john11.display).toBe('太初有道，道與　神同在，道就是　神。');
  });

  test('manifest 各檔 bytes 與實際檔案相符', () => {
    for (const f of Object.values(manifest.files)) {
      expect(statSync(join(dataDir, f.path)).size).toBe(f.bytes);
    }
  });
});
