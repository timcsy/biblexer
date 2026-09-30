// 信望愛 `unv`（FHL 和合本，神版）資料解析（research R1）
import { bookByCode } from '../../src/core/canon.ts';
import type { VerseRef } from '../../src/core/refs.ts';
import { extractNotes } from '../../src/core/text.ts';

export interface UnvRow {
  engs: string;
  chap: number;
  sec: number;
  txt: string;
}

export interface ParsedVerse {
  ref: VerseRef;
  /** 顯示用經文（保留「　神」、譯註）；合併節佔位為空字串 */
  display: string;
  notes: string[];
  /** 若為 "a" 佔位，指向承載內容的同章前一節 */
  mergedInto?: VerseRef;
  variant: boolean;
}

/** 信望愛比新標點和合本多出的 11 節異文經節 */
export const VARIANT_VERSES: ReadonlyArray<readonly [string, number, number]> = [
  ['Matt', 18, 11],
  ['Matt', 23, 14],
  ['Mark', 7, 16],
  ['Mark', 15, 28],
  ['Luke', 17, 36],
  ['Luke', 23, 17],
  ['John', 5, 4],
  ['Acts', 8, 37],
  ['Acts', 15, 34],
  ['Acts', 24, 7],
  ['Acts', 28, 29],
];

const variantKeys = new Set(VARIANT_VERSES.map(([b, c, v]) => `${b} ${c}:${v}`));

/** 移除 Strong's 標記 `<W…>`、`{<W…>}` 群組，以及殘留的單獨大括號 */
export function stripStrongs(txt: string): string {
  return txt
    .replace(/\{(?:<[^>]*>)*\}/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[{}]/g, '');
}

export function parseUnvRows(rows: readonly UnvRow[]): ParsedVerse[] {
  const out: ParsedVerse[] = [];
  for (const row of rows) {
    const book = bookByCode(row.engs);
    if (!book) throw new Error(`未知書卷代碼：${row.engs}`);
    const ref: VerseRef = { book: book.id, chapter: row.chap, verse: row.sec };
    const variant = variantKeys.has(`${row.engs} ${row.chap}:${row.sec}`);
    if (row.txt === 'a') {
      const prev = out.at(-1);
      if (!prev || prev.ref.book !== ref.book || prev.ref.chapter !== ref.chapter || prev.ref.verse !== ref.verse - 1) {
        throw new Error(`合併節佔位沒有承接同章前一節：${row.engs} ${row.chap}:${row.sec}`);
      }
      out.push({ ref, display: '', notes: [], mergedInto: prev.mergedInto ?? prev.ref, variant });
      continue;
    }
    const display = stripStrongs(row.txt);
    out.push({ ref, display, notes: extractNotes(display), variant });
  }
  return out;
}
