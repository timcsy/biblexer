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

export interface Unit {
  id: number;
  start: number;
  end: number;
  passageId: number;
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

export function buildUnits(passages: readonly Passage[]): Unit[] {
  const out: Unit[] = [];
  for (const p of passages) {
    const len = p.end - p.start + 1;
    if (len <= UNIT_SIZE) {
      out.push({ id: out.length, start: p.start, end: p.end, passageId: p.id });
      continue;
    }
    let s = p.start;
    for (; s + UNIT_SIZE - 1 <= p.end; s += UNIT_STRIDE) {
      out.push({ id: out.length, start: s, end: s + UNIT_SIZE - 1, passageId: p.id });
    }
    const last = out.at(-1)!;
    if (last.end < p.end) {
      out.push({ id: out.length, start: p.end - UNIT_SIZE + 1, end: p.end, passageId: p.id });
    }
  }
  return out;
}
