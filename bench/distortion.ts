// 版面失真度量（knowledge/draft/2026-10-05-混合曲率作為人機介面的基石.md〈兩種書卷層全貌＝兩種度量〉）：
// 同一本書上有兩種距離——順序距離（隔幾行；一維、歐氏）與結構距離（同段 < 同章 < 不同章；樹）。
// 量各種版面（長卷、每列六頁、章節地圖）在畫面上的歐氏距離，對這兩種距離保留了多少。
import type { Layout } from '../src/reader/layout.ts';
import { lineRect } from '../src/reader/world.ts';

/** 一個段落在某種版面中的位置 */
export interface ParaPoint {
  /** 段落在全書的序號（閱讀順序） */
  index: number;
  /** 段落起點所在的行（版面行號） */
  line: number;
  chapter: number;
  x: number;
  y: number;
}

export function paragraphPoints(layout: Layout): ParaPoint[] {
  return layout.paragraphs.map((p, index) => {
    const r = lineRect(layout, layout.lines[p.line]!.pos);
    const chapter = layout.chapters.filter((c) => c.line <= p.line).at(-1)?.chapter ?? 1;
    return { index, line: p.line, chapter, x: r.x, y: r.y };
  });
}

/** 順序距離：相隔的版面行數 */
export const seqDistance = (a: ParaPoint, b: ParaPoint): number => Math.abs(a.line - b.line);

/** 結構距離（樹：段 → 章 → 書，每條邊長 1）：同一段 0、同章不同段 2、不同章 4 */
export const treeDistance = (a: ParaPoint, b: ParaPoint): number => (a.index === b.index ? 0 : a.chapter === b.chapter ? 2 : 4);

export const layoutDistance = (a: ParaPoint, b: ParaPoint): number => Math.hypot(a.x - b.x, a.y - b.y);

function ranks(xs: readonly number[]): number[] {
  const order = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[order[k]![1]] = avg;
    i = j + 1;
  }
  return r;
}

/** Spearman 等級相關（平手取平均等級）：1＝版面距離與該度量完全同序 */
export function spearman(xs: readonly number[], ys: readonly number[]): number {
  const rx = ranks(xs);
  const ry = ranks(ys);
  const n = rx.length;
  const mx = rx.reduce((s, v) => s + v, 0) / n;
  const my = ry.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (rx[i]! - mx) * (ry[i]! - my);
    vx += (rx[i]! - mx) ** 2;
    vy += (ry[i]! - my) ** 2;
  }
  return cov / Math.sqrt(vx * vy);
}

/**
 * 鄰居保留率：每個段落在版面上最近的 k 個段落中，有多少是該度量下的鄰居。
 * - tree：鄰居＝同一章的其他段落（k＝同章段落數 − 1）
 * - seq：鄰居＝閱讀順序上的前一段與後一段（k＝1 或 2）
 * 平手時依閱讀順序先取。回傳所有段落的平均（沒有鄰居的段落不計）。
 */
export function neighborPrecision(pts: readonly ParaPoint[], metric: 'tree' | 'seq'): number {
  let sum = 0;
  let count = 0;
  for (const p of pts) {
    const truth = new Set(metric === 'tree' ? pts.filter((q) => q.chapter === p.chapter && q.index !== p.index).map((q) => q.index) : [p.index - 1, p.index + 1].filter((i) => i >= 0 && i < pts.length));
    if (truth.size === 0) continue;
    const near = pts
      .filter((q) => q.index !== p.index)
      .sort((a, b) => layoutDistance(p, a) - layoutDistance(p, b) || a.index - b.index)
      .slice(0, truth.size);
    sum += near.filter((q) => truth.has(q.index)).length / truth.size;
    count++;
  }
  return count ? sum / count : 1;
}

/** 對一種版面算出所有指標 */
export function measure(layout: Layout): { paragraphs: number; spearmanSeq: number; spearmanTree: number; neighborsSeq: number; neighborsTree: number } {
  const pts = paragraphPoints(layout);
  const e: number[] = [];
  const ds: number[] = [];
  const dt: number[] = [];
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      e.push(layoutDistance(pts[i]!, pts[j]!));
      ds.push(seqDistance(pts[i]!, pts[j]!));
      dt.push(treeDistance(pts[i]!, pts[j]!));
    }
  return { paragraphs: pts.length, spearmanSeq: spearman(e, ds), spearmanTree: spearman(e, dt), neighborsSeq: neighborPrecision(pts, 'seq'), neighborsTree: neighborPrecision(pts, 'tree') };
}
