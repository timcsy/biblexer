// 相機：層級、著陸點、吸附（research R4；根公理「連續地探索，離散地著陸」）
// 版面不動（layout.ts）；視窗大小只改變相機（原則 1）。每個層級的著陸點集合都由文本結構定義（原則 3）。
import type { Layout } from './layout.ts';
import { WORLD, bookTiles, columnRect, gridRect, lineRect, pageRect } from './world.ts';

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
/** 頁面網格的書卷層：章號以固定的螢幕字級排在網格左側，所需寬度以 px 計 */
const BOOK_LABEL_PX = 120;

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
    // 框水平置中；頂端對齊框的上緣——永遠看到完整的一欄或一頁，不把頁切開（FR-011a、research R4a；初版對齊著陸點那一行）。
    // 段落著陸點只改變 at（介面以標記呈現），不移動畫面。
    return { x: frame.x - (vw - frame.w) / 2, y: frame.y, scale, focus: lp.id, at: lp.id };
  }
  const m = SCREEN_MARGIN / scale;
  // 段落輪廓層：以段落所在的頁為中心，整頁完整顯示、左右露出前後幾頁（FR-023：不切開頁）；
  // 同一頁的段落相機位置相同，段落以標籤標示
  if (lp.level === 'outline') {
    const page = pageRect(ctx.layout, ctx.layout.lines[lp.line!]!.pos.page);
    const vh = ctx.viewport.height / scale;
    return { x: page.x + page.w / 2 - vw / 2, y: page.y + page.h / 2 - vh / 2, scale, at: lp.id, ...(focus !== undefined ? { focus } : {}) };
  }
  // 書卷層（看全貌，FR-022）：不切開全貌——
  // 放得進畫面就整張置中（同一畫面上所有章的相機相同，目前的章以標示呈現）；
  // 放不下時保住左側章號欄，並讓該章那一列在畫面上方
  if (lp.level === 'book') {
    const g = gridRect(ctx.layout);
    const vh = ctx.viewport.height / scale;
    const label = ctx.layout.lineRects ? 0 : BOOK_LABEL_PX / scale; // 頁面網格的章號排在網格左側
    const x = g.w + 2 * m + label <= vw ? g.x + g.w / 2 - vw / 2 - label / 2 : g.x - m - label;
    let y: number;
    if (g.h + 2 * m <= vh) y = g.y + g.h / 2 - vh / 2;
    else {
      const pos = ctx.layout.lines[lp.line!]!.pos;
      // 章節地圖：章那一列的頂端；頁面網格：章所在頁那一列的頂端
      const rowTop = ctx.layout.lineRects ? lineRect(ctx.layout, pos).y : Math.floor(pos.page / ctx.layout.params.pagesPerRow) * WORLD.pageHeight;
      y = rowTop - m;
    }
    return { x, y, scale, at: lp.id, ...(focus !== undefined ? { focus } : {}) };
  }
  // 其他層：著陸點放在視窗左上角（留一點邊），讓後面的內容出現在畫面上
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

/** 精讀時著陸點所在的框：手機為欄、桌機為頁（依閱讀順序編號） */
function frameIndex(lp: LandingPoint, ctx: CameraContext): number {
  const pos = ctx.layout.lines[lp.line!]!.pos;
  return ctx.mode === 'page' ? pos.page : pos.page * ctx.layout.params.columnsPerPage + pos.column;
}

const PAN_INTENT_PX = 64; // 平移超過這個距離（或視窗短邊的 8%）就視為「要往那個方向走」

/**
 * 平移（拖曳、捲動）放手後吸附。
 * - 精讀層、移動不到一個畫面：一次翻一框（上／下一欄或一頁，依閱讀順序，不是世界中正下方那一列）。
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
    // 精讀層、移動不到一個畫面：一次翻一框（依閱讀順序，不是世界中正下方那一列）
    const here = landingPoints(ctx.layout, 'reading').find((p) => p.id === from.at)!;
    if (small) return placeAt(here, ctx);
    const d = vertical ? dy : dx;
    return step(from, ctx, d > 0 ? 1 : -1, 'frame');
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

const DESCENT: ZoomLevel[] = ['canon', 'book', 'outline', 'reading'];

/**
 * 一層一層下去（使用者回饋 2026-10-06：「從書卷到章到段落到頁面的過程」要看得到）：
 * 從目前層級到精讀的某一節，沿途每一層的停靠點——書卷層的那一章 → 段落輪廓的那一段 → 精讀。
 * 各層的相機以該層自己的排列（ctxFor）計算。
 */
export function descentStops(from: ZoomLevel, verseIdx: number, ctxFor: (level: ZoomLevel) => CameraContext): Array<{ level: ZoomLevel; ctx: CameraContext; camera: Camera }> {
  const lastAtOrBefore = (pts: LandingPoint[]) => pts.filter((p) => p.verseIdx !== null && p.verseIdx <= verseIdx).at(-1) ?? pts[0]!;
  return DESCENT.slice(DESCENT.indexOf(from) + 1).map((level) => {
    const ctx = ctxFor(level);
    const camera = level === 'reading' ? cameraForVerse(verseIdx, ctx) : placeAt(lastAtOrBefore(landingPoints(ctx.layout, level)), ctx);
    return { level, ctx, camera };
  });
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
  const idx = pts.findIndex((p) => p.id === cur.at);
  if (unit === 'landing') {
    // 一段一段：依閱讀順序（行號）前進；同一框內只移動標記，跨框才翻
    const next = pts[Math.min(pts.length - 1, Math.max(0, idx + dir))]!;
    return next.id === cur.at ? cur : placeAt(next, ctx);
  }
  const here = frameIndex(pts[idx]!, ctx);
  const tops = pts.filter((p) => {
    const pos = ctx.layout.lines[p.line!]!.pos;
    return pos.line === 0 && (ctx.mode === 'column' || pos.column === 0);
  });
  const next = dir === 1 ? tops.find((p) => frameIndex(p, ctx) > here) : tops.findLast((p) => frameIndex(p, ctx) < here);
  return next ? placeAt(next, ctx) : cur;
}

/** 視窗大小改變：版面不動，相機重新對準原本的著陸點（保留 focus） */
export function refit(c: Camera, from: CameraContext, to: CameraContext): Camera {
  const level = levelOf(c.scale, from.readingScale);
  const lp = c.at ? landingPoints(to.layout, level).find((p) => p.id === c.at) : undefined;
  if (lp) return level === 'reading' ? placeAt(lp, to) : placeAt(lp, to, c.focus);
  return snap({ ...c, scale: (c.scale / from.readingScale) * to.readingScale }, to);
}

/**
 * 排列切換（research R3a）：停在著陸點上時，在新的排列中放到同一個著陸點；
 * 手勢中則讓視窗中心所在的頁在螢幕上不動，其他頁圍繞它重排。
 * 著陸點代號與 focus 在兩種排列下相同（都以行、段落、欄定義）。
 */
export function remap(c: Camera, from: CameraContext, to: CameraContext): Camera {
  if (from.layout === to.layout) return c;
  // 停在著陸點上：在新的排列中放到同一個著陸點
  if (c.at) {
    const lp = landingPoints(to.layout, levelOf(c.scale, to.readingScale)).find((p) => p.id === c.at);
    if (lp) return placeAt(lp, to, c.focus);
  }
  // 手勢中：視窗中心最近的那一行在螢幕上不動
  const center = viewCenter(c, from);
  let best = 0;
  let bestD = Infinity;
  for (const l of from.layout.lines) {
    const r = lineRect(from.layout, l.pos);
    const dx = Math.max(r.x - center.x, 0, center.x - (r.x + r.w));
    const dy = Math.max(r.y - center.y, 0, center.y - (r.y + r.h));
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = l.index;
    }
  }
  const a = lineRect(from.layout, from.layout.lines[best]!.pos);
  const b = lineRect(to.layout, to.layout.lines[best]!.pos);
  return { ...c, x: c.x + (b.x - a.x), y: c.y + (b.y - a.y) };
}

/**
 * 過場路徑（van Wijk & Nuij 2003, "Smooth and efficient zooming and panning"）：
 * 遠距離時先拉遠、平移、再拉近；回傳持續時間（ms）與 t∈[0,1] 的相機。t=1 恰為目標（含著陸點與 focus）。
 */
export function flyPath(a: Camera, b: Camera, ctx: CameraContext): { duration: number; at(t: number): Camera } {
  const W = ctx.viewport.width;
  const H = ctx.viewport.height;
  const rho = Math.SQRT2;
  const rho2 = rho * rho;
  const rho4 = rho2 * rho2;
  const [ux0, uy0, w0] = [a.x + W / (2 * a.scale), a.y + H / (2 * a.scale), W / a.scale];
  const [ux1, uy1, w1] = [b.x + W / (2 * b.scale), b.y + H / (2 * b.scale), W / b.scale];
  const dx = ux1 - ux0;
  const dy = uy1 - uy0;
  const d2 = dx * dx + dy * dy;
  let S: number;
  let path: (t: number) => [number, number, number];
  if (d2 < 1e-12) {
    S = Math.log(w1 / w0) / rho;
    path = (t) => [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S)];
  } else {
    const d1 = Math.sqrt(d2);
    const b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1);
    const b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1);
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
    const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
    S = (r1 - r0) / rho;
    path = (t) => {
      const s = t * S;
      const coshr0 = Math.cosh(r0);
      const u = (w0 / (rho2 * d1)) * (coshr0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
      return [ux0 + u * dx, uy0 + u * dy, (w0 * coshr0) / Math.cosh(rho * s + r0)];
    };
  }
  // 同一層內（翻頁、換段）要快；跨層級（如書卷層 → 頁面）放慢，讓讀者看清楚整個轉場、感覺真的「過去了」
  // （使用者回饋 2026-10-06；正典層 ↔ 書卷層的分段過場約 2.9 秒，見 Reader.tsx 的 MORPH_MS）
  const crossesLevel = levelOf(a.scale, ctx.readingScale) !== levelOf(b.scale, ctx.readingScale);
  const duration = crossesLevel ? Math.min(1800, Math.max(1100, 900 + 300 * Math.abs(S))) : Math.min(650, Math.max(180, 180 + 160 * Math.abs(S)));
  return {
    duration,
    at(t) {
      if (t >= 1) return b;
      const [ux, uy, w] = path(t);
      const scale = W / w;
      return { x: ux - W / (2 * scale), y: uy - H / (2 * scale), scale, ...(b.focus !== undefined ? { focus: b.focus } : {}) };
    },
  };
}

/**
 * 縮小後點擊（FR-021）：在書卷層或段落輪廓點到某一行，就以該行所在段落進入精讀。
 * 縮放層級是一棵樹（正典 → 章 → 段落），每點一下往下一層——對數級的找法，底數是每層的分支數。
 */
export function tapTarget(c: Camera, pt: Point, ctx: CameraContext): Camera | null {
  const level = levelOf(c.scale, ctx.readingScale);
  if (level !== 'book' && level !== 'outline') return null;
  const wx = c.x + pt.x / c.scale;
  const wy = c.y + pt.y / c.scale;
  // 章節地圖：點到一塊（含塊內空白處）就進入那一段
  const block = ctx.layout.blocks?.find((b) => wx >= b.rect.x && wx <= b.rect.x + b.rect.w && wy >= b.rect.y && wy <= b.rect.y + b.rect.h);
  if (block) return cameraForVerse(block.verseIdx, ctx);
  const line = ctx.layout.lines.find((l) => {
    const r = lineRect(ctx.layout, l.pos);
    return wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h;
  });
  if (!line) return null;
  const verse = firstVerseFrom(ctx.layout, line.index);
  return verse === null ? null : cameraForVerse(verse, ctx);
}

const SCRUB_MAGNET = 0.012; // 拖到章刻度這個距離內就吸到該章開頭（占全長的比例）

/**
 * 拖動進度條（FR-020）：對應紙本的「按比例翻開 → 看頁眉 → 微調」。
 * 位置 f∈[0,1] 依行數比例對應到某一頁的頂端；接近章刻度時吸到該章開頭。
 */
export function scrubTarget(f: number, ctx: CameraContext): { chapter: number; page: number; camera: Camera } {
  const { layout } = ctx;
  const n = layout.lines.length;
  const x = Math.min(1, Math.max(0, f));
  const near = layout.chapters.filter((ch) => Math.abs(ch.line / n - x) <= SCRUB_MAGNET).sort((a, b) => Math.abs(a.line / n - x) - Math.abs(b.line / n - x))[0];
  if (near) {
    return { chapter: near.chapter, page: layout.lines[near.line]!.pos.page + 1, camera: cameraForVerse(firstVerseFrom(layout, near.line) ?? 0, ctx) };
  }
  const line = layout.lines[Math.min(n - 1, Math.floor(x * n))]!;
  const page = line.pos.page;
  const top = landingPoints(layout, 'reading').find((p) => {
    const pos = layout.lines[p.line!]!.pos;
    return pos.page === page && pos.column === 0 && pos.line === 0;
  })!;
  const chapter = layout.chapters.filter((ch) => ch.line <= line.index).at(-1)?.chapter ?? 1;
  return { chapter, page: page + 1, camera: placeAt(top, ctx) };
}

/** 章刻度在進度條上的位置 */
scrubTarget.tickOf = (ctx: CameraContext, chapter: number): number => {
  const ch = ctx.layout.chapters.find((c) => c.chapter === chapter);
  return ch ? ch.line / ctx.layout.lines.length : 0;
};
