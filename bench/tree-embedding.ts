// 層級（樹）分別嵌入平面與龐加萊圓盤的失真（knowledge/draft/2026-10-05-混合曲率作為人機介面的基石.md 的下一步）：
// 回答「什麼規模的層級才需要雙曲」——用數字，而不是用意象（衍生原則 3）。

import type { Point, TreeNode } from '../src/reader/hyperbolic.ts';
export type { Point, TreeNode } from '../src/reader/hyperbolic.ts';

const depths = new WeakMap<readonly TreeNode[], Int32Array>();
function depthOf(tree: readonly TreeNode[]): Int32Array {
  let d = depths.get(tree);
  if (d) return d;
  d = new Int32Array(tree.length);
  for (let i = 1; i < tree.length; i++) d[i] = d[tree[i]!.parent]! + 1;
  depths.set(tree, d);
  return d;
}

/** 樹距離：經過最近共同祖先的邊數 */
export function treeDistance(tree: readonly TreeNode[], a: number, b: number): number {
  const d = depthOf(tree);
  let x = a;
  let y = b;
  let n = 0;
  while (x !== y) {
    if (d[x]! >= d[y]!) x = tree[x]!.parent;
    else y = tree[y]!.parent;
    n++;
  }
  return n;
}

export { poincareDistance, sarkarEmbed } from '../src/reader/hyperbolic.ts';

function children(tree: readonly TreeNode[]): number[][] {
  const ch: number[][] = tree.map(() => []);
  for (let i = 1; i < tree.length; i++) ch[tree[i]!.parent]!.push(i);
  return ch;
}

/** 平面放射佈局（比較基準）：深度 k 的點在半徑 k 的圓上，角度扇區依葉子數分配 */
export function radialEuclidean(tree: readonly TreeNode[]): Point[] {
  const ch = children(tree);
  const leaves = new Float64Array(tree.length);
  for (let i = tree.length - 1; i >= 0; i--) leaves[i] = ch[i]!.length ? ch[i]!.reduce((s, c) => s + leaves[c]!, 0) : 1;
  const d = depthOf(tree);
  const pts: Point[] = new Array(tree.length);
  const wedge = (v: number, a0: number, a1: number) => {
    const mid = (a0 + a1) / 2;
    pts[v] = [d[v]! * Math.cos(mid), d[v]! * Math.sin(mid)];
    let a = a0;
    for (const c of ch[v]!) {
      const span = ((a1 - a0) * leaves[c]!) / leaves[v]!;
      wedge(c, a, a + span);
      a += span;
    }
  };
  wedge(0, 0, 2 * Math.PI);
  return pts;
}

/**
 * 失真（與尺度無關）：每一對的比值 r = 嵌入距離 ／ 樹距離；以中位數 c 為全域縮放，
 * mean＝平均 |ln(r/c)|，worst＝max(r)/min(r)。0／1 表示只差一個全域縮放。
 */
export function distortion(tree: readonly TreeNode[], pairs: ReadonlyArray<[number, number]>, emb: (a: number, b: number) => number): { mean: number; worst: number } {
  const ratios = pairs.map(([a, b]) => emb(a, b) / treeDistance(tree, a, b)).filter((x) => Number.isFinite(x) && x > 0);
  const sorted = [...ratios].sort((x, y) => x - y);
  const c = sorted[Math.floor(sorted.length / 2)]!;
  const mean = ratios.reduce((s, x) => s + Math.abs(Math.log(x / c)), 0) / ratios.length;
  return { mean, worst: sorted.at(-1)! / sorted[0]! };
}
