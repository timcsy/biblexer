import { bookByCode, bookById } from './canon.ts';

export interface VerseRef {
  book: number;
  chapter: number;
  verse: number;
}

/** 以全書經節索引（0 起算）表示的閉區間 */
export interface IndexRange {
  start: number;
  end: number;
}

export function compareRefs(a: VerseRef, b: VerseRef): number {
  return a.book - b.book || a.chapter - b.chapter || a.verse - b.verse;
}

export function overlaps(a: IndexRange, b: IndexRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** 解析信望愛代碼格式「代碼 章:節」，如 `Phil 4:6`、`1 Sam 17:1` */
export function parseRefString(s: string): VerseRef | null {
  const m = /^(.+?)\s+(\d+):(\d+)$/.exec(s.trim());
  if (!m) return null;
  const book = bookByCode(m[1]!);
  if (!book) return null;
  return { book: book.id, chapter: Number(m[2]), verse: Number(m[3]) };
}

/** 顯示用出處，如「約翰福音 2:1–11」「約翰福音 2:25–3:2」 */
export function formatRange(start: VerseRef, end: VerseRef): string {
  const name = bookById(start.book)?.name ?? '';
  if (start.chapter === end.chapter) {
    return start.verse === end.verse
      ? `${name} ${start.chapter}:${start.verse}`
      : `${name} ${start.chapter}:${start.verse}–${end.verse}`;
  }
  return `${name} ${start.chapter}:${start.verse}–${end.chapter}:${end.verse}`;
}
