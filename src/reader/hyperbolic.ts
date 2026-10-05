// 正典的雙曲全貌（原型；knowledge/draft/2026-10-05-混合曲率作為人機介面的基石.md〈全本層級：平面 vs 雙曲〉）：
// 正典 → 書卷 → 章 的樹以 Sarkar 構造嵌入龐加萊圓盤；焦點以莫比烏斯等距變換移到圓心（焦點加上下文）。
// 每個名詞都對應到這裡的函式（衍生原則 3）。

export type Point = [number, number];

/** 樹以父節點索引表示；根的 parent = -1，且子節點的索引一律大於父節點 */
export interface TreeNode {
  parent: number;
}

export interface CanonNode extends TreeNode {
  /** 根為 null */
  book: number | null;
  /** 書卷節點為 null */
  chapter: number | null;
}

/** 正典樹：根 → 書卷（依正典順序）→ 章 */
export function canonTree(chapterCounts: ReadonlyArray<[book: number, chapters: number]>): CanonNode[] {
  const t: CanonNode[] = [{ parent: -1, book: null, chapter: null }];
  const bookIdx = chapterCounts.map(([book]) => t.push({ parent: 0, book, chapter: null }) - 1);
  chapterCounts.forEach(([book, n], k) => {
    for (let c = 1; c <= n; c++) t.push({ parent: bookIdx[k]!, book, chapter: c });
  });
  return t;
}

/** 龐加萊圓盤上的雙曲距離 */
export function poincareDistance(p: Point, q: Point): number {
  const dx = p[0] - q[0];
  const dy = p[1] - q[1];
  const num = 2 * (dx * dx + dy * dy);
  const den = (1 - p[0] * p[0] - p[1] * p[1]) * (1 - q[0] * q[0] - q[1] * q[1]);
  return Math.acosh(1 + num / den);
}

// 複數運算
const mul = (a: Point, b: Point): Point => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a: Point, b: Point): Point => {
  const n = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / n, (a[1] * b[0] - a[0] * b[1]) / n];
};
const conj = (a: Point): Point => [a[0], -a[1]];

/** 焦點變換：把 f 移到圓心的等距變換 (z − f) / (1 − f̄ z) */
export function focusOn(f: Point, z: Point): Point {
  const fz = mul(conj(f), z);
  return div([z[0] - f[0], z[1] - f[1]], [1 - fz[0], -fz[1]]);
}

/** 逆變換：(w + f) / (1 + f̄ w) */
export function unfocus(f: Point, w: Point): Point {
  const fw = mul(conj(f), w);
  return div([w[0] + f[0], w[1] + f[1]], [1 + fw[0], fw[1]]);
}

/** 從焦點 a 沿測地線走向 b 的比例 t（0＝a、1＝b）：連續換焦點用 */
export function geodesicFocus(a: Point, b: Point, t: number): Point {
  const w = focusOn(a, b);
  const r = Math.hypot(w[0], w[1]);
  if (r < 1e-15) return a;
  const rt = Math.tanh(t * Math.atanh(Math.min(r, 1 - 1e-15)));
  return unfocus(a, [(w[0] / r) * rt, (w[1] / r) * rt]);
}

/**
 * Sarkar 的樹嵌入：每條邊的雙曲長度都是 τ；子節點在「以父為中心」的座標中均分角度，
 * 避開指向祖父的方向。
 */
export function sarkarEmbed(tree: readonly TreeNode[], tau: number): Point[] {
  const ch: number[][] = tree.map(() => []);
  for (let i = 1; i < tree.length; i++) ch[tree[i]!.parent]!.push(i);
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
      const wp = focusOn(zv, pts[tree[v]!.parent]!);
      theta = Math.atan2(wp[1], wp[0]);
      slots = kids.length + 1; // 留一個位置給指向父節點的方向
    }
    kids.forEach((c, k) => {
      const phi = theta + (2 * Math.PI * (k + (v === 0 ? 0 : 1))) / slots;
      pts[c] = unfocus(zv, [r * Math.cos(phi), r * Math.sin(phi)]);
    });
  }
  return pts;
}
