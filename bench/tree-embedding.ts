// 層級（樹）分別嵌入平面與龐加萊圓盤的失真（knowledge/draft/2026-10-05-混合曲率作為人機介面的基石.md 的下一步）：
// 回答「什麼規模的層級才需要雙曲」——用數字，而不是用意象（衍生原則 3）。

/** 樹以父節點索引表示；根的 parent = -1，且子節點的索引一律大於父節點 */
export interface TreeNode {
  parent: number;
}

export type Point = [number, number];

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

/** 龐加萊圓盤上的雙曲距離 */
export function poincareDistance(p: Point, q: Point): number {
  const dx = p[0] - q[0];
  const dy = p[1] - q[1];
  const num = 2 * (dx * dx + dy * dy);
  const den = (1 - p[0] * p[0] - p[1] * p[1]) * (1 - q[0] * q[0] - q[1] * q[1]);
  return Math.acosh(1 + num / den);
}

// 複數運算（圓盤上的莫比烏斯等距變換）
const mul = (a: Point, b: Point): Point => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a: Point, b: Point): Point => {
  const n = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / n, (a[1] * b[0] - a[0] * b[1]) / n];
};
const conj = (a: Point): Point => [a[0], -a[1]];
/** 把 a 移到原點的等距變換：(z − a) / (1 − ā z) */
const toOrigin = (a: Point, z: Point): Point => div([z[0] - a[0], z[1] - a[1]], [1 - mul(conj(a), z)[0], -mul(conj(a), z)[1]]);
/** 逆變換：(w + a) / (1 + ā w) */
const fromOrigin = (a: Point, w: Point): Point => div([w[0] + a[0], w[1] + a[1]], [1 + mul(conj(a), w)[0], mul(conj(a), w)[1]]);

function children(tree: readonly TreeNode[]): number[][] {
  const ch: number[][] = tree.map(() => []);
  for (let i = 1; i < tree.length; i++) ch[tree[i]!.parent]!.push(i);
  return ch;
}

/**
 * Sarkar 的樹嵌入（龐加萊圓盤）：每條邊的雙曲長度都是 τ；子節點在「以父為中心」的座標中均分角度，
 * 避開指向祖父的方向。τ 越大、失真越小（分支多時需要較大的 τ）。
 */
export function sarkarEmbed(tree: readonly TreeNode[], tau: number): Point[] {
  const ch = children(tree);
  const pts: Point[] = new Array(tree.length);
  pts[0] = [0, 0];
  const r = Math.tanh(tau / 2);
  for (let v = 0; v < tree.length; v++) {
    const kids = ch[v]!;
    if (!kids.length) continue;
    const zv = pts[v]!;
    let theta = 0;
    let slots = kids.length;
    if (v !== 0) {
      const wp = toOrigin(zv, pts[tree[v]!.parent]!);
      theta = Math.atan2(wp[1], wp[0]);
      slots = kids.length + 1; // 留一個位置給指向父節點的方向
    }
    kids.forEach((c, k) => {
      const phi = theta + (2 * Math.PI * (k + (v === 0 ? 0 : 1))) / slots;
      pts[c] = fromOrigin(zv, [r * Math.cos(phi), r * Math.sin(phi)]);
    });
  }
  return pts;
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
