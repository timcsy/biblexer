// 守護：雙曲全貌第二版（原型）——約的半球、各層邊長、依篇幅分配角度、拖曳焦點、吸附最近書卷
import { describe, expect, test } from 'vitest';
import { canonTreeV2, dragFocus, embedWeighted, focusOn, nearestBook, poincareDistance, type Point } from '../../src/reader/hyperbolic.ts';

// 兩卷舊約、三卷新約（書卷 1、2 屬舊約；40、41、42 屬新約）
const books: Array<[number, number, number]> = [
  [1, 3, 100],
  [2, 2, 40],
  [40, 2, 50],
  [41, 1, 10],
  [42, 4, 200],
];
const tree = canonTreeV2(books);
const TAU = { testament: 1.2, book: 2.4, chapter: 1.0 };
const pts = embedWeighted(tree, TAU);
const idx = (pred: (n: (typeof tree)[number]) => boolean) => tree.findIndex(pred);

describe('第二版正典樹', () => {
  test('根 → 約（舊約、新約）→ 書卷 → 章', () => {
    expect(tree.filter((n) => n.kind === 'testament').map((n) => n.testament)).toEqual(['OT', 'NT']);
    expect(tree.filter((n) => n.kind === 'book').map((n) => n.book)).toEqual([1, 2, 40, 41, 42]);
    expect(tree.filter((n) => n.kind === 'chapter').length).toBe(12);
  });

  test('舊約在左、新約在右', () => {
    expect(pts[idx((n) => n.testament === 'OT' && n.kind === 'testament')]![0]).toBeLessThan(0);
    expect(pts[idx((n) => n.testament === 'NT' && n.kind === 'testament')]![0]).toBeGreaterThan(0);
  });

  test('每層邊長：約 τt、書卷 τb、章 τc（章緊貼書卷）', () => {
    tree.forEach((n, i) => {
      if (i === 0) return;
      const d = poincareDistance(pts[i]!, pts[n.parent]!);
      expect(d).toBeCloseTo(n.kind === 'testament' ? TAU.testament : n.kind === 'book' ? TAU.book : TAU.chapter, 6);
    });
  });

  test('角度依篇幅分配：從父節點看，篇幅大的兄弟之間角距較大', () => {
    const nt = idx((n) => n.testament === 'NT' && n.kind === 'testament');
    const ang = (b: number) => {
      const w = focusOn(pts[nt]!, pts[idx((n) => n.kind === 'book' && n.book === b)]!);
      return Math.atan2(w[1], w[0]);
    };
    const gap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(ang(a) - ang(b)), Math.cos(ang(a) - ang(b))));
    // 41（10 節）夾在 40（50）與 42（200）之間：41–42 的角距大於 40–41
    expect(gap(41, 42)).toBeGreaterThan(gap(40, 41));
  });
});

describe('拖曳與吸附', () => {
  test('拖曳後焦點仍在圓盤內；拖過去再拖回來約回到原處', () => {
    const f: Point = [0.2, -0.1];
    const moved = dragFocus(f, [0.05, 0.02]);
    expect(Math.hypot(...moved)).toBeLessThan(1);
    const back = dragFocus(moved, [-0.05, -0.02]);
    expect(poincareDistance(back, f)).toBeLessThan(0.02);
  });

  test('放手吸附到雙曲距離最近的書卷', () => {
    const b42 = pts[idx((n) => n.kind === 'book' && n.book === 42)]!;
    const near: Point = [b42[0] * 0.98, b42[1] * 0.98];
    expect(nearestBook(near, tree, pts)).toBe(42);
  });
});
