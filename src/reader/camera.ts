// 相機：層級、著陸點、吸附（research R4；根公理「連續地探索，離散地著陸」）
// 版面不動（layout.ts）；視窗大小只改變相機（原則 1）。每個層級的著陸點集合都由文本結構定義（原則 3）。
import type { Layout } from './layout.ts';
import { WORLD, bookTiles, columnRect, lineRect, pageRect } from './world.ts';

export type ZoomLevel = 'canon' | 'book' | 'outline' | 'reading';
export const LEVELS: readonly ZoomLevel[] = ['canon', 'book', 'outline', 'reading'];

/** 各層級的標準比例（× 精讀比例 r）；皆落在該層級的比例範圍內 */
export const LEVEL_SCALE: Readonly<Record<ZoomLevel, number>> = { reading: 1, outline: 0.4, book: 0.12, canon: 0.03 };
export const MIN_SCALE = 0.02;
export const MAX_SCALE = 1.5;

export interface Point {
  x: number;
  y: number;
}

export interface Camera {
  /** 視窗左上角在世界中的位置 */
  x: number;
  y: number;
  /** 世界單位 → 螢幕像素 */
  scale: number;
  /** 最近一次在精讀層停留的著陸點；平移時清除，縮放時保留 */
  focus?: string;
  /** 目前停在哪個著陸點（吸附後才有；手勢中清除） */
  at?: string;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface CameraContext {
  layout: Layout;
  viewport: Viewport;
  /** 精讀比例 r */
  readingScale: number;
  /** 精讀時一次看一欄（手機）或一頁（桌機） */
  mode: 'column' | 'page';
}

export interface LandingPoint {
  id: string;
  level: ZoomLevel;
  /** 行或區塊的左上角 */
  anchor: Point;
  verseIdx: number | null;
  /** 所在的行（書卷與正典以外） */
  line?: number;
}

const MARGIN = 1; // 精讀時框的左右留白（格）
const MIN_PAGE_CELL_PX = 16; // 一格至少幾 px 才以整頁閱讀
const MAX_CELL_PX = 32;

export function createContext(layout: Layout, viewport: Viewport): CameraContext {
  const pageW = pageRect(layout, 0).w + 2 * MARGIN;
  const colW = WORLD.columnWidth + 2 * MARGIN;
  const mode = viewport.width / pageW >= MIN_PAGE_CELL_PX ? 'page' : 'column';
  const columnH = layout.params.linesPerColumn * WORLD.lineHeight;
  const readingScale = Math.min(viewport.width / (mode === 'page' ? pageW : colW), viewport.height / columnH, MAX_CELL_PX);
  return { layout, viewport, readingScale, mode };
}

export function levelOf(scale: number, readingScale: number): ZoomLevel {
  const k = scale / readingScale;
  return k >= 0.6 ? 'reading' : k >= 0.25 ? 'outline' : k >= 0.06 ? 'book' : 'canon';
}

const topLeft = (r: { x: number; y: number }): Point => ({ x: r.x, y: r.y });
const SCREEN_MARGIN = 16; // 非精讀層：著陸點與視窗左上角的距離（px）

const cache = new WeakMap<Layout, Map<ZoomLevel, LandingPoint[]>>();

export function landingPoints(layout: Layout, level: ZoomLevel): LandingPoint[] {
  let m = cache.get(layout);
  if (!m) cache.set(layout, (m = new Map()));
  let pts = m.get(level);
  if (!pts) m.set(level, (pts = computeLanding(layout, level)));
  return pts;
}

function computeLanding(layout: Layout, level: ZoomLevel): LandingPoint[] {
  const rectOf = (line: number) => lineRect(layout, layout.lines[line]!.pos);
  // 段落緊接章號標籤時，著陸點在標籤行（讓章號留在畫面上）
  const landLine = (line: number) => (layout.lines[line - 1]?.chapterStart ? line - 1 : line);
  if (level === 'canon') {
    return bookTiles(layout).map((t) => ({ id: `book:${t.book}`, level, anchor: topLeft(t.rect), verseIdx: t.book === layout.book ? 0 : null }));
  }
  if (level === 'book') {
    return layout.chapters.map((c) => ({ id: `chapter:${layout.book}:${c.chapter}`, level, anchor: topLeft(rectOf(c.line)), verseIdx: firstVerseFrom(layout, c.line), line: c.line }));
  }
  if (level === 'outline') {
    return layout.paragraphs.map((p) => ({ id: `para:${p.verseIdx}`, level, anchor: topLeft(rectOf(landLine(p.line))), verseIdx: p.verseIdx, line: landLine(p.line) }));
  }
  // 精讀：段落起點 ∪ 欄頂端；同一行兩者皆是時以段落起點為準
  const byLine = new Map<number, LandingPoint>();
  for (const l of layout.lines) {
    if (l.pos.line !== 0) continue;
    byLine.set(l.index, { id: `coltop:${l.pos.page}:${l.pos.column}`, level, anchor: { x: rectOf(l.index).x, y: rectOf(l.index).y }, verseIdx: firstVerseFrom(layout, l.index), line: l.index });
  }
  for (const p of layout.paragraphs) {
    const line = landLine(p.line);
    const r = rectOf(line);
    byLine.set(line, { id: `para:${p.verseIdx}`, level, anchor: { x: r.x, y: r.y }, verseIdx: p.verseIdx, line });
  }
  return [...byLine.values()].sort((a, b) => a.line! - b.line!);
}

function firstVerseFrom(layout: Layout, line: number): number | null {
  for (let i = line; i < layout.lines.length; i++) {
    const c = layout.lines[i]!.cells.find((x) => x.verseIdx !== null);
    if (c) return c.verseIdx;
  }
  return null;
}

/** 把相機放在某個著陸點上（該層級的標準比例） */
export function placeAt(lp: LandingPoint, ctx: CameraContext, focus?: string): Camera {
  const scale = LEVEL_SCALE[lp.level] * ctx.readingScale;
  const vw = ctx.viewport.width / scale;
  if (lp.level === 'reading') {
    const pos = ctx.layout.lines[lp.line!]!.pos;
    const frame = ctx.mode === 'page' ? pageRect(ctx.layout, pos.page) : columnRect(ctx.layout, pos.page, pos.column);
    // 框水平置中；頂端對齊行的上緣（FR-011）
    return { x: frame.x - (vw - frame.w) / 2, y: lp.anchor.y, scale, focus: lp.id, at: lp.id };
  }
  // 其他層：著陸點放在視窗左上角（留一點邊），讓後面的內容出現在畫面上
  const m = SCREEN_MARGIN / scale;
  return { x: lp.anchor.x - m, y: lp.anchor.y - m, scale, at: lp.id, ...(focus !== undefined ? { focus } : {}) };
}

const viewCenter = (c: Camera, ctx: CameraContext): Point => ({ x: c.x + ctx.viewport.width / (2 * c.scale), y: c.y + ctx.viewport.height / (2 * c.scale) });

/** 放手後吸附：比例到該層級標準比例，位置到最近的著陸點；精讀層優先回到 focus */
export function snap(c: Camera, ctx: CameraContext): Camera {
  const level = levelOf(c.scale, ctx.readingScale);
  const pts = landingPoints(ctx.layout, level);
  if (level === 'reading' && c.focus) {
    const f = pts.find((p) => p.id === c.focus);
    if (f) return placeAt(f, ctx);
  }
  const here = viewCenter(c, ctx);
  let best = pts[0]!;
  let bestD = Infinity;
  for (const p of pts) {
    const q = viewCenter(placeAt(p, ctx), ctx);
    const d = (q.x - here.x) ** 2 + (q.y - here.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return placeAt(best, ctx, c.focus);
}

const clampScale = (s: number, ctx: CameraContext) => Math.min(MAX_SCALE * ctx.readingScale, Math.max(MIN_SCALE * ctx.readingScale, s));

/** 以螢幕上的 anchor 為不動點縮放；保留 focus */
export function zoomAt(c: Camera, factor: number, anchor: Point, ctx: CameraContext): Camera {
  const scale = clampScale(c.scale * factor, ctx);
  const wx = c.x + anchor.x / c.scale;
  const wy = c.y + anchor.y / c.scale;
  return { x: wx - anchor.x / scale, y: wy - anchor.y / scale, scale, ...(c.focus !== undefined ? { focus: c.focus } : {}) };
}

/** 平移（螢幕像素）；清除 focus */
export function panBy(c: Camera, dx: number, dy: number, _ctx: CameraContext): Camera {
  return { x: c.x - dx / c.scale, y: c.y - dy / c.scale, scale: c.scale };
}

/** 精讀時一個著陸點在畫面上的位置：（框, 行）。整頁模式下左右兩欄的同一行是同一個位置 */
function readingSpot(lp: LandingPoint, ctx: CameraContext): number {
  const pos = ctx.layout.lines[lp.line!]!.pos;
  const frame = ctx.mode === 'page' ? pos.page : pos.page * ctx.layout.params.columnsPerPage + pos.column;
  return frame * ctx.layout.params.linesPerColumn + pos.line;
}

const orderCache = new WeakMap<CameraContext, LandingPoint[]>();

/** 精讀層的導覽順序：依畫面位置排列，同一位置只留一個（行號最小者，與 snap 的平手規則一致） */
function readingOrder(ctx: CameraContext): LandingPoint[] {
  let list = orderCache.get(ctx);
  if (list) return list;
  const bySpot = new Map<number, LandingPoint>();
  for (const p of landingPoints(ctx.layout, 'reading')) {
    const k = readingSpot(p, ctx);
    if (!bySpot.has(k)) bySpot.set(k, p);
  }
  list = [...bySpot.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p);
  orderCache.set(ctx, list);
  return list;
}

const PAN_INTENT_PX = 64; // 平移超過這個距離（或視窗短邊的 8%）就視為「要往那個方向走」

/**
 * 平移（拖曳、捲動）放手後吸附。
 * - 精讀層、移動不到一個畫面：依閱讀順序決定落點——垂直移動 n 行就往閱讀順序前後找著陸點
 *   （一欄或一頁的底部接到下一欄或下一頁，不是世界中正下方那一列）；水平移動到上／下一框。
 * - 移動很小：留在原處。
 * - 其他情況（拖得很遠、非精讀層）：一般的 snap；若吸附結果仍在原處，沿移動方向前進一步。
 * 否則小幅度的捲動或拖曳永遠會被吸回原處，讀者走不出去。
 */
export function snapToward(c: Camera, from: Camera, ctx: CameraContext): Camera {
  const s = snap(c, ctx);
  const level = levelOf(c.scale, ctx.readingScale);
  if (!from.at || level !== levelOf(from.scale, ctx.readingScale)) return s;
  const dx = (c.x - from.x) * c.scale;
  const dy = (c.y - from.y) * c.scale;
  const threshold = Math.min(PAN_INTENT_PX, 0.08 * Math.min(ctx.viewport.width, ctx.viewport.height));
  const small = Math.max(Math.abs(dx), Math.abs(dy)) < threshold;
  const vertical = Math.abs(dy) >= Math.abs(dx);

  if (level === 'reading' && Math.abs(dx) < ctx.viewport.width && Math.abs(dy) < ctx.viewport.height) {
    const here = readingOrder(ctx).find((p) => p.id === from.at) ?? landingPoints(ctx.layout, 'reading').find((p) => p.id === from.at)!;
    if (small) return placeAt(here, ctx);
    if (!vertical) return step(from, ctx, dx > 0 ? 1 : -1, 'frame');
    const spot = readingSpot(here, ctx);
    const target = spot + dy / (WORLD.lineHeight * c.scale);
    const list = readingOrder(ctx);
    const next =
      dy > 0
        ? (list.filter((p) => readingSpot(p, ctx) > spot && readingSpot(p, ctx) <= target).at(-1) ?? list.find((p) => readingSpot(p, ctx) > spot))
        : (list.find((p) => readingSpot(p, ctx) < spot && readingSpot(p, ctx) >= target) ?? list.findLast((p) => readingSpot(p, ctx) < spot));
    return next ? placeAt(next, ctx) : placeAt(here, ctx);
  }

  // 比較的是相機位置，不是著陸點代號
  const samePlace = Math.abs(s.x - from.x) < 1e-9 && Math.abs(s.y - from.y) < 1e-9 && s.scale === from.scale;
  if (!samePlace || small) return s;
  return vertical ? step(from, ctx, dy > 0 ? 1 : -1, 'landing') : step(from, ctx, dx > 0 ? 1 : -1, 'frame');
}

/** 精讀層、該節所在段落起點 */
export function cameraForVerse(verseIdx: number, ctx: CameraContext): Camera {
  const pts = landingPoints(ctx.layout, 'reading');
  const paras = pts.filter((p) => p.id.startsWith('para:') && p.verseIdx! <= verseIdx);
  return placeAt(paras.at(-1) ?? pts[0]!, ctx);
}

/**
 * 按鈕：沿結構上下移動一個層級——放大到含目前經節的下一層著陸點（精讀層有 focus 時回到 focus），
 * 縮小到含它的段落、章、書卷。保留 focus。
 */
export function zoomStep(c: Camera, ctx: CameraContext, dir: 1 | -1): Camera {
  const cur = c.at ? c : snap(c, ctx);
  const level = levelOf(cur.scale, ctx.readingScale);
  const next = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, LEVELS.indexOf(level) + dir))]!;
  if (next === level) return cur;
  const here = landingPoints(ctx.layout, level).find((p) => p.id === cur.at)!;
  // 正典層的其他書卷不可進入
  if (here.verseIdx === null) return cur;
  if (next === 'reading' && cur.focus) return snap({ ...cur, scale: ctx.readingScale }, ctx);
  const pts = landingPoints(ctx.layout, next);
  const target =
    next === 'canon'
      ? pts.find((p) => p.id === `book:${ctx.layout.book}`)!
      : next === 'reading'
        ? (pts.filter((p) => p.id.startsWith('para:') && p.verseIdx! <= here.verseIdx!).at(-1) ?? pts[0]!)
        : (pts.filter((p) => p.verseIdx! <= here.verseIdx!).at(-1) ?? pts[0]!);
  return placeAt(target, ctx, cur.focus);
}

/** 鍵盤：到下一個／上一個著陸點（landing），或下一個／上一個框——手機為欄、桌機為頁（frame） */
export function step(c: Camera, ctx: CameraContext, dir: 1 | -1, unit: 'landing' | 'frame'): Camera {
  const cur = c.at ? c : snap(c, ctx);
  const level = levelOf(cur.scale, ctx.readingScale);
  const pts = landingPoints(ctx.layout, level);
  if (level !== 'reading') {
    const idx = pts.findIndex((p) => p.id === cur.at);
    const next = pts[Math.min(pts.length - 1, Math.max(0, idx + dir))]!;
    // 換到別的著陸點是移動，不是縮放：清除 focus
    return next.id === cur.at ? cur : placeAt(next, ctx);
  }
  const here = readingSpot(pts.find((p) => p.id === cur.at)!, ctx);
  const perFrame = ctx.layout.params.linesPerColumn;
  const list = readingOrder(ctx);
  const isFrameTop = (p: LandingPoint) => readingSpot(p, ctx) % perFrame === 0;
  const candidates = unit === 'landing' ? list : list.filter(isFrameTop);
  const next = dir === 1 ? candidates.find((p) => readingSpot(p, ctx) > here) : candidates.findLast((p) => readingSpot(p, ctx) < here);
  return next ? placeAt(next, ctx) : cur;
}

/** 視窗大小改變：版面不動，相機重新對準原本的著陸點（保留 focus） */
export function refit(c: Camera, from: CameraContext, to: CameraContext): Camera {
  const level = levelOf(c.scale, from.readingScale);
  const lp = c.at ? landingPoints(to.layout, level).find((p) => p.id === c.at) : undefined;
  if (lp) return level === 'reading' ? placeAt(lp, to) : placeAt(lp, to, c.focus);
  return snap({ ...c, scale: (c.scale / from.readingScale) * to.readingScale }, to);
}
