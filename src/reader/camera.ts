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
  /** 精讀層：行的左上角；其他層：區塊中心 */
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

const center = (r: { x: number; y: number; w: number; h: number }): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

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
    return bookTiles(layout).map((t) => ({ id: `book:${t.book}`, level, anchor: center(t.rect), verseIdx: t.book === layout.book ? 0 : null }));
  }
  if (level === 'book') {
    return layout.chapters.map((c) => ({ id: `chapter:${layout.book}:${c.chapter}`, level, anchor: center(rectOf(c.line)), verseIdx: firstVerseFrom(layout, c.line), line: c.line }));
  }
  if (level === 'outline') {
    return layout.paragraphs.map((p) => ({ id: `para:${p.verseIdx}`, level, anchor: center(rectOf(landLine(p.line))), verseIdx: p.verseIdx, line: landLine(p.line) }));
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
  const vh = ctx.viewport.height / scale;
  if (lp.level === 'reading') {
    const pos = ctx.layout.lines[lp.line!]!.pos;
    const frame = ctx.mode === 'page' ? pageRect(ctx.layout, pos.page) : columnRect(ctx.layout, pos.page, pos.column);
    // 框水平置中；頂端對齊行的上緣（FR-011）
    return { x: frame.x - (vw - frame.w) / 2, y: lp.anchor.y, scale, focus: lp.id, at: lp.id };
  }
  return { x: lp.anchor.x - vw / 2, y: lp.anchor.y - vh / 2, scale, at: lp.id, ...(focus !== undefined ? { focus } : {}) };
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

/** 精讀層、該節所在段落起點 */
export function cameraForVerse(verseIdx: number, ctx: CameraContext): Camera {
  const pts = landingPoints(ctx.layout, 'reading');
  const paras = pts.filter((p) => p.id.startsWith('para:') && p.verseIdx! <= verseIdx);
  return placeAt(paras.at(-1) ?? pts[0]!, ctx);
}

/** 按鈕：到上一個／下一個層級的標準比例（以視窗中心縮放），然後吸附 */
export function zoomStep(c: Camera, ctx: CameraContext, dir: 1 | -1): Camera {
  const i = LEVELS.indexOf(levelOf(c.scale, ctx.readingScale));
  const next = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, i + dir))]!;
  const z = zoomAt(c, (LEVEL_SCALE[next] * ctx.readingScale) / c.scale, { x: ctx.viewport.width / 2, y: ctx.viewport.height / 2 }, ctx);
  return snap(z, ctx);
}

/** 鍵盤：到下一個／上一個著陸點（landing），或下一個／上一個框——手機為欄、桌機為頁（frame） */
export function step(c: Camera, ctx: CameraContext, dir: 1 | -1, unit: 'landing' | 'frame'): Camera {
  const cur = c.at ? c : snap(c, ctx);
  const level = levelOf(cur.scale, ctx.readingScale);
  const pts = landingPoints(ctx.layout, level);
  const idx = pts.findIndex((p) => p.id === cur.at);
  if (level !== 'reading' || unit === 'landing') {
    const next = pts[Math.min(pts.length - 1, Math.max(0, idx + dir))]!;
    return next.id === cur.at ? cur : placeAt(next, ctx, cur.focus);
  }
  const line = pts[idx]!.line!;
  const isFrame = (p: LandingPoint) => {
    const pos = ctx.layout.lines[p.line!]!.pos;
    return pos.line === 0 && (ctx.mode === 'column' || pos.column === 0);
  };
  const frames = pts.filter(isFrame);
  const next = dir === 1 ? frames.find((p) => p.line! > line) : frames.findLast((p) => p.line! < line);
  return next ? placeAt(next, ctx) : cur;
}

/** 視窗大小改變：版面不動，相機重新對準原本的著陸點（保留 focus） */
export function refit(c: Camera, from: CameraContext, to: CameraContext): Camera {
  const level = levelOf(c.scale, from.readingScale);
  const lp = c.at ? landingPoints(to.layout, level).find((p) => p.id === c.at) : undefined;
  if (lp) return level === 'reading' ? placeAt(lp, to) : placeAt(lp, to, c.focus);
  return snap({ ...c, scale: (c.scale / from.readingScale) * to.readingScale }, to);
}
