// 守護：FR-024 命中判定
import { describe, expect, test } from 'vitest';
import { bestHitRank, isHit } from '../../src/core/hit.ts';

describe('命中判定', () => {
  test('與任一期望範圍重疊即命中', () => {
    expect(isHit({ start: 10, end: 14 }, [{ start: 14, end: 14 }])).toBe(true);
    expect(isHit({ start: 10, end: 14 }, [{ start: 20, end: 30 }, { start: 0, end: 10 }])).toBe(true);
    expect(isHit({ start: 10, end: 14 }, [{ start: 15, end: 30 }])).toBe(false);
  });

  test('最佳命中名次（1 起算）；沒有命中為 null', () => {
    const results = [{ start: 0, end: 3 }, { start: 50, end: 55 }, { start: 10, end: 12 }];
    expect(bestHitRank(results, [{ start: 11, end: 11 }])).toBe(3);
    expect(bestHitRank(results, [{ start: 100, end: 101 }])).toBeNull();
  });
});
