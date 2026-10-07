// 讀者自己的記號（spec 006）：一節經文的位置（書卷、章、節），只存在讀者的裝置上。
// 記號只來自讀者的點擊，系統不替讀者下記號（原則 4、9）。

export interface MarkRef {
  book: number;
  chapter: number;
  verse: number;
}

const same = (a: MarkRef, b: MarkRef) => a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;

export const hasMark = (marks: readonly MarkRef[], r: MarkRef): boolean => marks.some((m) => same(m, r));

/** 加上或取消（同一節不重複） */
export function toggleMark(marks: readonly MarkRef[], r: MarkRef): MarkRef[] {
  return hasMark(marks, r) ? marks.filter((m) => !same(m, r)) : [...marks, { book: r.book, chapter: r.chapter, verse: r.verse }];
}

export const marksInBook = (marks: readonly MarkRef[], book: number): MarkRef[] => marks.filter((m) => m.book === book);

export const serializeMarks = (marks: readonly MarkRef[]): string => JSON.stringify(marks.map((m) => [m.book, m.chapter, m.verse]));

/** 容錯：不是 JSON、格式不對的項目一律略過 */
export function deserializeMarks(json: string | null): MarkRef[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is [number, number, number] => Array.isArray(x) && x.length === 3 && x.every((n) => Number.isInteger(n) && n > 0)).map(([book, chapter, verse]) => ({ book, chapter, verse }));
  } catch {
    return [];
  }
}
