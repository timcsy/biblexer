export interface Ranked {
  id: number;
  score: number;
}

/** 分數遞減；同分以 id 遞增（決定性） */
export const byScoreThenId = (a: Ranked, b: Ranked): number => b.score - a.score || a.id - b.id;
