// 守護：spec 004 SC-004、SC-005、FR-012——串珠參照表（npm run test:data，須在 npm run build:data 之後執行）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { decodeVerses } from '../../src/core/artifacts.ts';
import { decodeXrefs, type XrefTable } from '../../src/core/xrefs.ts';

const dataDir = join(import.meta.dirname, '../../public/data');
type Manifest = { files: Record<string, { path: string }>; sources: Array<{ name: string; license: string }> };
let manifest: Manifest;
let at: (book: number, chapter: number, verse: number) => number;
let ubs: XrefTable;
let tsk: XrefTable;
const read = (key: string) => readFileSync(join(dataDir, manifest.files[key]!.path));
const buf = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
/** 某節的目標裡，有沒有涵蓋另一節 */
const covers = (t: XrefTable, from: number, to: number) => t.targets(from).some(([s, e]) => s <= to && to <= e);

beforeAll(() => {
  manifest = JSON.parse(readFileSync(join(dataDir, 'manifest.json'), 'utf8')) as Manifest;
  const verses = decodeVerses(read('verses').toString('utf8'));
  const index = new Map(verses.map((v, i) => [`${v.ref.book}:${v.ref.chapter}:${v.ref.verse}`, i]));
  at = (b, c, v) => index.get(`${b}:${c}:${v}`)!;
  ubs = decodeXrefs(buf(read('xrefUbs')));
  tsk = decodeXrefs(buf(read('xrefTsk')));
});

describe('串珠參照表', () => {
  test('兩份參照表都涵蓋全本 31,103 節', () => {
    expect(ubs.verseCount).toBe(31103);
    expect(tsk.verseCount).toBe(31103);
  });

  test('SC-005：羅 1:17 ↔ 哈 2:4（UBS 明引，雙向）；太 5:38 → 出 21:24（希伯來文編號換算的章）', () => {
    expect(covers(ubs, at(45, 1, 17), at(35, 2, 4))).toBe(true);
    expect(covers(ubs, at(35, 2, 4), at(45, 1, 17))).toBe(true);
    expect(covers(ubs, at(40, 5, 38), at(2, 21, 24))).toBe(true);
  });

  test('詩篇編號換算：羅 3:4 引詩 51:4（希伯來文編號 51:6）', () => {
    expect(covers(ubs, at(45, 3, 4), at(19, 51, 4))).toBe(true);
  });

  test('SC-005：羅 8:28 的 TSK 參照含創 50:20', () => {
    expect(covers(tsk, at(45, 8, 28), at(1, 50, 20))).toBe(true);
  });

  test('SC-004：羅馬書每一條明引都落在和合本存在的經節上（目標範圍合法、不顛倒）', () => {
    const first = at(45, 1, 1);
    const last = at(45, 16, 27);
    let n = 0;
    for (let v = first; v <= last; v++)
      for (const [s, e] of ubs.targets(v)) {
        expect(s).toBeLessThanOrEqual(e);
        expect(e).toBeLessThan(31103);
        n++;
      }
    expect(n).toBeGreaterThan(40);
  });

  test('FR-012：UBS 資料檔與授權全文獨立發布；來源列在 manifest，含授權', () => {
    expect(manifest.files.xrefUbs!.path).toMatch(/^xref-ubs\./);
    expect(read('xrefUbsLicense').toString('utf8')).toContain('Attribution-ShareAlike 4.0');
    const names = manifest.sources.map((s) => s.name).join('｜');
    expect(names).toContain('UBS Parallel Passages Database');
    expect(names).toContain('Treasury of Scripture Knowledge');
  });
});
