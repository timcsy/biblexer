// 守護：bench/tree-embedding.ts——層級（樹）分別嵌入平面與龐加萊圓盤的幾何（混合曲率草稿的下一步）
import { describe, expect, test } from 'vitest';
import { distortion, poincareDistance, radialEuclidean, sarkarEmbed, treeDistance, type TreeNode } from '../../bench/tree-embedding.ts';

// 根 → 3 個子 → 每個 3 個孫
const tree: TreeNode[] = [{ parent: -1 }];
for (let i = 0; i < 3; i++) {
  tree.push({ parent: 0 });
  const c = tree.length - 1;
  for (let j = 0; j < 3; j++) tree.push({ parent: c });
}

describe('距離', () => {
  test('龐加萊圓盤：原點到 (r,0) 的距離 = 2·artanh(r)；對稱；自身為 0', () => {
    expect(poincareDistance([0, 0], [0.5, 0])).toBeCloseTo(2 * Math.atanh(0.5), 12);
    expect(poincareDistance([0.3, 0.1], [-0.2, 0.4])).toBeCloseTo(poincareDistance([-0.2, 0.4], [0.3, 0.1]), 12);
    expect(poincareDistance([0.3, 0.1], [0.3, 0.1])).toBeCloseTo(0, 12);
  });

  test('樹距離：兄弟 2、孫到根 2、不同枝的孫 4', () => {
    expect(treeDistance(tree, 1, 5)).toBe(2);
    expect(treeDistance(tree, 2, 0)).toBe(2);
    expect(treeDistance(tree, 2, 6)).toBe(4);
  });
});

describe('嵌入', () => {
  test('Sarkar：每條邊在雙曲距離下長度都是 τ；全部點在圓盤內', () => {
    const tau = 2;
    const pts = sarkarEmbed(tree, tau);
    for (let i = 1; i < tree.length; i++) expect(poincareDistance(pts[i]!, pts[tree[i]!.parent]!)).toBeCloseTo(tau, 6);
    for (const p of pts) expect(Math.hypot(p[0], p[1])).toBeLessThan(1);
  });

  test('平面放射佈局：深度 k 的點在半徑 k 的圓上', () => {
    const pts = radialEuclidean(tree);
    expect(Math.hypot(...pts[0]!)).toBeCloseTo(0, 12);
    expect(Math.hypot(...pts[1]!)).toBeCloseTo(1, 12);
    expect(Math.hypot(...pts[2]!)).toBeCloseTo(2, 12);
  });

  test('失真：完美縮放的嵌入失真為 0；Sarkar 在大 τ 時的失真小於平面放射佈局', () => {
    const pairs: Array<[number, number]> = [];
    for (let a = 0; a < tree.length; a++) for (let b = a + 1; b < tree.length; b++) pairs.push([a, b]);
    // 只差一個全域縮放：失真為 0（失真與尺度無關）
    const exact = distortion(tree, pairs, (a, b) => 2 * treeDistance(tree, a, b));
    expect(exact.mean).toBeCloseTo(0, 12);
    const s = sarkarEmbed(tree, 6);
    const e = radialEuclidean(tree);
    const hyp = distortion(tree, pairs, (a, b) => poincareDistance(s[a]!, s[b]!));
    const euc = distortion(tree, pairs, (a, b) => Math.hypot(e[a]![0] - e[b]![0], e[a]![1] - e[b]![1]));
    expect(hyp.mean).toBeLessThan(euc.mean);
  });
});
