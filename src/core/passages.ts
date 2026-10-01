// 分段邊界 → 段落 → 檢索單元（data-model Passage / RetrievalUnit）
//
// 段落邊界是一種「視角」（knowledge/draft/2026-09-30-段落邊界是一種視角.md）：
// 每個段落記錄它依據的分段視角 id；本功能只有一組。

export const SEGMENTATION_ID = 'cu89-paragraphs';
export const MAX_PASSAGE_VERSES = 12;
export const UNIT_SIZE = 3;
export const UNIT_STRIDE = 2;

export interface Passage {
  id: number;
  /** 起訖經節索引（閉區間） */
  start: number;
  end: number;
  segmentation: string;
}

export type UnitScale = 'verse' | 'window' | 'passage';
export const SCALE_CODES: Readonly<Record<UnitScale, number>> = { verse: 0, window: 1, passage: 2 };
export const SCALES: readonly UnitScale[] = ['verse', 'window', 'passage'];

export interface Unit {
  id: number;
  start: number;
  end: number;
  passageId: number;
  scale: UnitScale;
}

/**
 * @param chapterKeys 每一節經文所屬章的鍵（同章相同、依經節順序排列）
 * @param starts 分段起點（經節索引）
 */
export function buildPassages(chapterKeys: ReadonlyArray<number | string>, starts: ReadonlySet<number>): Passage[] {
  const raw: Array<[number, number]> = [];
  let begin = 0;
  for (let i = 1; i <= chapterKeys.length; i++) {
    const boundary = i === chapterKeys.length || chapterKeys[i] !== chapterKeys[i - 1] || starts.has(i);
    if (boundary) {
      raw.push([begin, i - 1]);
      begin = i;
    }
  }

  const out: Passage[] = [];
  for (const [s, e] of raw) {
    const len = e - s + 1;
    const pieces = Math.ceil(len / MAX_PASSAGE_VERSES);
    // 平均切成 pieces 段，每段 ≤ MAX_PASSAGE_VERSES
    for (let k = 0; k < pieces; k++) {
      const ps = s + Math.floor((k * len) / pieces);
      const pe = s + Math.floor(((k + 1) * len) / pieces) - 1;
      out.push({ id: out.length, start: ps, end: pe, segmentation: SEGMENTATION_ID });
    }
  }
  return out;
}

/**
 * 多尺度檢索單元（research R10）：單節（排在最前面，id 0..V-1，關鍵字索引的文件 id 即單元 id）、
 * 3 節視窗（段落內滑動、步長 2）、整段（只為 > 3 節的段落建立，避免與視窗重複）。
 * @param opts.skipVerse 不建立單節單元的經節（合併節佔位）
 */
export function buildUnits(passages: readonly Passage[], opts: { skipVerse?: (verseIdx: number) => boolean } = {}): Unit[] {
  const out: Unit[] = [];
  const push = (start: number, end: number, passageId: number, scale: UnitScale) =>
    out.push({ id: out.length, start, end, passageId, scale });

  for (const p of passages) {
    for (let i = p.start; i <= p.end; i++) if (!opts.skipVerse?.(i)) push(i, i, p.id, 'verse');
  }
  for (const p of passages) {
    const len = p.end - p.start + 1;
    if (len <= UNIT_SIZE) {
      push(p.start, p.end, p.id, 'window');
      continue;
    }
    let s = p.start;
    let lastEnd = -1;
    for (; s + UNIT_SIZE - 1 <= p.end; s += UNIT_STRIDE) {
      push(s, s + UNIT_SIZE - 1, p.id, 'window');
      lastEnd = s + UNIT_SIZE - 1;
    }
    if (lastEnd < p.end) push(p.end - UNIT_SIZE + 1, p.end, p.id, 'window');
  }
  for (const p of passages) {
    if (p.end - p.start + 1 > UNIT_SIZE) push(p.start, p.end, p.id, 'passage');
  }
  return out;
}
