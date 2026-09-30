// 命中判定（spec FR-024）：評測與驗收共用
import { overlaps, type IndexRange } from './refs.ts';

export const HIT_TOP_N = 5;

export function isHit(result: IndexRange, expected: readonly IndexRange[]): boolean {
  return expected.some((e) => overlaps(result, e));
}

/** 第一個命中的名次（1 起算）；沒有命中回傳 null */
export function bestHitRank(results: readonly IndexRange[], expected: readonly IndexRange[]): number | null {
  const i = results.findIndex((r) => isHit(r, expected));
  return i < 0 ? null : i + 1;
}
