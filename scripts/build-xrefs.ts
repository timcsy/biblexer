// 串珠參照表（spec 004 FR-007、FR-008、FR-012）：UBS 明引 → xref-ubs.bin（＋授權全文）；TSK → xref-tsk.bin
import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync, unzlibSync } from 'fflate';
import type { StoredVerse } from '../src/core/artifacts.ts';
import { encodeXrefs } from '../src/core/xrefs.ts';
import { makeOrgToEng, parseTskRefs, parseUbsQuotes, USFM_BOOKS, type Range, type Ref } from './lib/xref-sources.ts';
import { writeHashed, type WrittenFile } from './lib/paths.ts';

export interface XrefBuild {
  files: { xrefUbs: WrittenFile; xrefUbsLicense: WrittenFile; xrefTsk: WrittenFile };
}

/** 經節 → 全本流水號；合併節（如 29–30 的後一節）歸到前一節；不存在的經節回 null */
function verseIndex(verses: readonly StoredVerse[]) {
  const index = new Map(verses.map((v, i) => [`${v.ref.book}:${v.ref.chapter}:${v.ref.verse}`, i]));
  const at = (r: Ref): number | null => {
    let i = index.get(`${r.book}:${r.chapter}:${r.verse}`);
    if (i === undefined) return null;
    while (i > 0 && verses[i]!.merged) i--;
    return i;
  };
  return (range: Range): [number, number] | null => {
    const s = at(range.start);
    const e = at(range.end);
    if (s === null || e === null || e < s) return null;
    return [s, e];
  };
}

/** SWORD zCom 模組（TSK）：每一節的 ThML 內容，依 KJV 經節順序 */
function readZcom(files: Record<string, Uint8Array>, testament: 'ot' | 'nt'): (i: number) => string {
  const dir = 'modules/comments/zcom/tsk/';
  const bzs = new DataView(files[`${dir}${testament}.bzs`]!.slice().buffer);
  const bzz = files[`${dir}${testament}.bzz`]!;
  const bzv = new DataView(files[`${dir}${testament}.bzv`]!.slice().buffer);
  const cache = new Map<number, Uint8Array>();
  const block = (b: number) => {
    let u = cache.get(b);
    if (!u) {
      const off = bzs.getUint32(b * 12, true);
      const size = bzs.getUint32(b * 12 + 4, true);
      u = unzlibSync(bzz.subarray(off, off + size));
      cache.set(b, u);
    }
    return u;
  };
  return (i) => {
    const b = bzv.getUint32(i * 10, true);
    const o = bzv.getUint32(i * 10 + 4, true);
    const s = bzv.getUint16(i * 10 + 8, true);
    return s ? strFromU8(block(b).subarray(o, o + s)) : '';
  };
}

export function buildXrefFiles(src: { ubs: string; ubsLicense: string; versification: string; tsk: string }, verses: readonly StoredVerse[]): XrefBuild {
  const toIdx = verseIndex(verses);
  const eng = JSON.parse(readFileSync(src.versification, 'utf8')) as { mappedVerses: Record<string, string>; maxVerses: Record<string, string[]> };

  // ── UBS：新約明引舊約，雙向 ──
  const toEng = makeOrgToEng(eng);
  const mapRange = (r: Range): Range | null => {
    const s = toEng(r.start);
    const e = toEng(r.end);
    return s && e ? { start: s, end: e } : null;
  };
  const ubsPer: Array<Array<[number, number]>> = verses.map(() => []);
  let ubsGroups = 0;
  let ubsSkipped = 0;
  for (const g of parseUbsQuotes(readFileSync(src.ubs, 'utf8'))) {
    const conv = (rs: Range[]) =>
      rs.flatMap((r) => {
        const m = mapRange(r);
        const i = m && toIdx(m);
        if (!i) ubsSkipped++;
        return i ? [i] : [];
      });
    const ot = conv(g.ot);
    const nt = conv(g.nt);
    if (!ot.length || !nt.length) continue;
    ubsGroups++;
    for (const [from, to] of [
      [nt, ot],
      [ot, nt],
    ] as const)
      for (const [s, e] of from) for (let v = s; v <= e; v++) for (const t of to) if (!ubsPer[v]!.some(([a, b]) => a === t[0] && b === t[1])) ubsPer[v]!.push(t);
  }
  const ubsCount = ubsPer.reduce((n, t) => n + t.length, 0);
  console.log(`串珠第一層（UBS 明引）：${ubsGroups} 組、${ubsCount} 條參照（雙向）；換算後不存在而略過 ${ubsSkipped} 處`);

  // ── TSK：依 KJV 經節順序走過索引（[0] 模組標頭、[1] 約標頭；每卷一個書卷標頭、每章一個章標頭）──
  // KJV 與 eng 編號只差：約三 14 節（eng 15）、啟 12 章 17 節（eng 18）
  const kjv = Object.fromEntries(USFM_BOOKS.map((c) => [c, eng.maxVerses[c]!.map(Number)])) as Record<string, number[]>;
  kjv['3JN'] = [14];
  kjv['REV']![11] = 17;
  const zip = unzipSync(new Uint8Array(readFileSync(src.tsk)));
  const tskPer: Array<Array<[number, number]>> = verses.map(() => []);
  let tskRefs = 0;
  let tskSkipped = 0;
  for (const [testament, books] of [
    ['ot', USFM_BOOKS.slice(0, 39)],
    ['nt', USFM_BOOKS.slice(39)],
  ] as const) {
    const entry = readZcom(zip, testament);
    let i = 1;
    for (const code of books) {
      const book = USFM_BOOKS.indexOf(code) + 1;
      i++;
      kjv[code]!.forEach((n, ci) => {
        i++;
        for (let verse = 1; verse <= n; verse++) {
          i++;
          const from = toIdx({ start: { book, chapter: ci + 1, verse }, end: { book, chapter: ci + 1, verse } });
          if (!from) continue;
          for (const r of parseTskRefs(entry(i), { book, chapter: ci + 1 })) {
            const t = toIdx(r);
            if (!t) {
              tskSkipped++;
              continue;
            }
            const list = tskPer[from[0]]!;
            if (!list.some(([a, b]) => a === t[0] && b === t[1])) {
              list.push(t);
              tskRefs++;
            }
          }
        }
      });
    }
  }
  console.log(`TSK 串珠：${tskRefs} 條參照；在和合本中找不到而略過 ${tskSkipped} 處`);

  return {
    files: {
      xrefUbs: writeHashed('xref-ubs', 'bin', encodeXrefs(ubsPer)),
      xrefUbsLicense: writeHashed('xref-ubs-license', 'md', readFileSync(src.ubsLicense, 'utf8')),
      xrefTsk: writeHashed('xref-tsk', 'bin', encodeXrefs(tskPer)),
    },
  };
}
