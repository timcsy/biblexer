import { BOOKS, bookByCode, bookById } from './canon.ts';

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

export interface ParsedReference {
  book: number;
  chapter: number;
  from: number | null;
  to: number | null;
}

// 書名（全名與簡稱）依長度遞減，讓「約翰一書」「約一」優先於「約」
const NAMES = BOOKS.flatMap((b) => [
  [b.name, b.id],
  [b.short, b.id],
] as Array<[string, number]>).sort((a, b) => b[0].length - a[0].length);

const REF = /^\s*(\d+)\s*(?:[:：]\s*(\d+)(?:\s*[-–—~～至到]\s*(\d+))?|章(?:\s*(\d+)\s*節?(?:\s*[-–—~～至到]\s*(\d+)\s*節?)?)?)?\s*$/;

/** 解析「羅 8:28」「羅馬書8章28節」「羅8:28-30」「詩篇 23」等出處；一般句子回傳 null */
export function parseReference(text: string): ParsedReference | null {
  const t = text.trim();
  for (const [name, book] of NAMES) {
    if (!t.startsWith(name)) continue;
    const m = REF.exec(t.slice(name.length));
    if (!m) continue;
    const chapter = Number(m[1]);
    const from = m[2] ?? m[4];
    const to = m[3] ?? m[5] ?? from;
    return { book, chapter, from: from ? Number(from) : null, to: to ? Number(to) : null };
  }
  return null;
}

/** 對照經文：存在的章節回傳經節索引範圍，否則 null */
export function resolveReference(r: ParsedReference, verses: ReadonlyArray<{ book: number; chapter: number; verse: number }>): IndexRange | null {
  let start = -1;
  let end = -1;
  verses.forEach((v, i) => {
    if (v.book !== r.book || v.chapter !== r.chapter) return;
    if (r.from !== null && (v.verse < r.from || v.verse > (r.to ?? r.from))) return;
    if (start < 0) start = i;
    end = i;
  });
  if (start < 0) return null;
  if (r.from !== null && verses[start]!.verse !== r.from) return null;
  return { start, end };
}
