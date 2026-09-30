// 混合檢索的融合與段落聚合（research R5）
import { byScoreThenId, type Ranked } from './ranked.ts';

export const RRF_K = 60;

/** Reciprocal Rank Fusion：score(id) = Σ 1 / (k + rank)，rank 由 1 起算 */
export function rrf(lists: ReadonlyArray<readonly Ranked[]>, k = RRF_K): Ranked[] {
  const acc = new Map<number, number>();
  for (const list of lists) {
    list.forEach((r, i) => acc.set(r.id, (acc.get(r.id) ?? 0) + 1 / (k + i + 1)));
  }
  return [...acc].map(([id, score]) => ({ id, score })).sort(byScoreThenId);
}

/** 把檢索單元的排名聚合到段落：同一段落取最高分的單元 */
export function aggregateToPassages(units: readonly Ranked[], unitToPassage: Int32Array): Ranked[] {
  const best = new Map<number, number>();
  for (const u of units) {
    const p = unitToPassage[u.id];
    if (p === undefined) continue;
    const prev = best.get(p);
    if (prev === undefined || u.score > prev) best.set(p, u.score);
  }
  return [...best].map(([id, score]) => ({ id, score })).sort(byScoreThenId);
}
