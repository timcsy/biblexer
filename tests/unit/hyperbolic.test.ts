// 守護：src/reader/hyperbolic.ts——正典的雙曲全貌（原型）：焦點變換與測地線內插
import { describe, expect, test } from 'vitest';
import { canonTree, focusOn, geodesicFocus, poincareDistance, sarkarEmbed } from '../../src/reader/hyperbolic.ts';

describe('正典樹', () => {
  test('根 → 66 卷 → 各卷的章；節點記錄書卷與章', () => {
    const t = canonTree([[1, 3], [2, 2]]);
    expect(t.length).toBe(1 + 2 + 5);
    expect(t.filter((n) => n.chapter === null && n.book !== null).map((n) => n.book)).toEqual([1, 2]);
    expect(t.filter((n) => n.book === 2 && n.chapter !== null).map((n) => n.chapter)).toEqual([1, 2]);
  });
});

describe('焦點變換（莫比烏斯等距）', () => {
  const t = canonTree([[1, 3], [2, 2], [3, 4]]);
  const pts = sarkarEmbed(t, 2);

  test('焦點節點移到圓心；兩點間的雙曲距離不變', () => {
    const f = pts[2]!;
    const moved = pts.map((p) => focusOn(f, p));
    expect(Math.hypot(...moved[2]!)).toBeCloseTo(0, 12);
    expect(poincareDistance(moved[4]!, moved[6]!)).toBeCloseTo(poincareDistance(pts[4]!, pts[6]!), 9);
  });

  test('測地線內插：t=0 為原焦點、t=1 為新焦點；中點到兩端等距', () => {
    const a = pts[1]!;
    const b = pts[3]!;
    expect(geodesicFocus(a, b, 0)[0]).toBeCloseTo(a[0], 12);
    expect(geodesicFocus(a, b, 1)[0]).toBeCloseTo(b[0], 9);
    expect(geodesicFocus(a, b, 1)[1]).toBeCloseTo(b[1], 9);
    const m = geodesicFocus(a, b, 0.5);
    expect(poincareDistance(m, a)).toBeCloseTo(poincareDistance(m, b), 9);
  });
});
