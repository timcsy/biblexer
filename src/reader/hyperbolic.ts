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

// ── 第二版（原型）：約的半球、各層邊長、依篇幅分配角度、拖曳焦點 ──

export interface CanonNodeV2 extends TreeNode {
  kind: 'root' | 'testament' | 'book' | 'chapter';
  testament: 'OT' | 'NT' | null;
  book: number | null;
  chapter: number | null;
  /** 篇幅（節數）：決定分到的角度 */
  weight: number;
}

/** 正典樹第二版：根 → 約（舊約、新約）→ 書卷 → 章。books：[書卷, 章數, 節數]，依正典順序 */
export function canonTreeV2(books: ReadonlyArray<[book: number, chapters: number, verses: number]>): CanonNodeV2[] {
  const t: CanonNodeV2[] = [{ parent: -1, kind: 'root', testament: null, book: null, chapter: null, weight: 0 }];
  for (const tm of ['OT', 'NT'] as const) {
    const mine = books.filter(([b]) => (tm === 'OT' ? b <= 39 : b >= 40));
    if (!mine.length) continue;
    const ti = t.push({ parent: 0, kind: 'testament', testament: tm, book: null, chapter: null, weight: mine.reduce((s, [, , v]) => s + v, 0) }) - 1;
    for (const [book, chapters, verses] of mine) {
      const bi = t.push({ parent: ti, kind: 'book', testament: tm, book, chapter: null, weight: verses }) - 1;
      for (let c = 1; c <= chapters; c++) t.push({ parent: bi, kind: 'chapter', testament: tm, book, chapter: c, weight: verses / chapters });
    }
  }
  t[0]!.weight = t.filter((n) => n.kind === 'testament').reduce((s, n) => s + n.weight, 0);
  return t;
}

const PARENT_GAP = Math.PI / 2; // 子節點避開指向父節點的方向（留一個扇形）

/**
 * 加權嵌入：各層邊長不同（約 τt、書卷 τb、章 τc——章緊貼書卷）；子節點分到的角度與篇幅成比例；
 * 根的兩個子節點固定為舊約在左（角度 π）、新約在右（角度 0），換焦點後方向不變。
 */
export function embedWeighted(tree: readonly CanonNodeV2[], tau: { testament: number; book: number; chapter: number }): Point[] {
  const ch: number[][] = tree.map(() => []);
  for (let i = 1; i < tree.length; i++) ch[tree[i]!.parent]!.push(i);
  const pts: Point[] = new Array(tree.length);
  pts[0] = [0, 0];
  const radius = (k: CanonNodeV2['kind']) => Math.tanh((k === 'testament' ? tau.testament : k === 'book' ? tau.book : tau.chapter) / 2);
  for (let v = 0; v < tree.length; v++) {
    const kids = ch[v]!;
    if (!kids.length) continue;
    const zv = pts[v]!;
    const angles: number[] = [];
    if (v === 0) {
      for (const c of kids) angles.push(tree[c]!.testament === 'OT' ? Math.PI : 0);
    } else {
      const wp = focusOn(zv, pts[tree[v]!.parent]!);
      const toParent = Math.atan2(wp[1], wp[0]);
      const start = toParent + PARENT_GAP / 2;
      const span = 2 * Math.PI - PARENT_GAP;
      const total = kids.reduce((s, c) => s + tree[c]!.weight, 0);
      let a = start;
      for (const c of kids) {
        const w = (span * tree[c]!.weight) / total;
        angles.push(a + w / 2);
        a += w;
      }
    }
    kids.forEach((c, k) => {
      const r = radius(tree[c]!.kind);
      pts[c] = unfocus(zv, [r * Math.cos(angles[k]!), r * Math.sin(angles[k]!)]);
    });
  }
  return pts;
}

/** 拖曳：手指在圓盤座標中移動 d，畫面內容跟著移動——焦點往反方向移（保持在圓盤內） */
export function dragFocus(f: Point, d: Point): Point {
  const g = unfocus(f, [-d[0], -d[1]]);
  const n = Math.hypot(g[0], g[1]);
  return n < 0.999 ? g : [(g[0] / n) * 0.999, (g[1] / n) * 0.999];
}

/** 放手：吸附到雙曲距離最近的書卷 */
export function nearestBook(f: Point, tree: readonly CanonNodeV2[], pts: readonly Point[]): number {
  let best = -1;
  let bestD = Infinity;
  tree.forEach((n, i) => {
    if (n.kind !== 'book') return;
    const d = poincareDistance(f, pts[i]!);
    if (d < bestD) {
      bestD = d;
      best = n.book!;
    }
  });
  return best;
}
