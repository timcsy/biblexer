// 版面 → 世界座標（data-model「World」；research R3）
// 世界以「格」為單位；頁面每列 pagesPerRow 頁，由左而右、由上而下。
// 正典層級的 66 卷方塊與羅馬書的頁面網格同大，羅馬書方塊就是它的頁面網格本身——
// 所以從正典縮放到精讀是同一個幾何空間（根公理「連續地探索」）。
import { DEFAULT_LAYOUT, type Layout, type LinePos } from './layout.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const P = DEFAULT_LAYOUT;
const lineHeight = 1.75;
const columnWidth = P.cellsPerLine + 1; // 含懸掛格
const columnGap = 2;
const pageGapX = 4;
const pageGapY = 2 * lineHeight; // 頁與頁的垂直間距為整數行：世界中所有行都對齊同一個行網格（FR-011 不切行）
const tileGap = 40;
const BOOKS_PER_ROW = 11;
const ROMANS = 45;

export const WORLD = {
  lineHeight,
  columnWidth,
  columnGap,
  pageWidth: P.columnsPerPage * columnWidth + (P.columnsPerPage - 1) * columnGap + pageGapX,
  pageHeight: P.linesPerColumn * lineHeight + pageGapY,
  tileGap,
  booksPerRow: BOOKS_PER_ROW,
} as const;

export function pageRect(layout: Layout, page: number): Rect {
  const { pagesPerRow, columnsPerPage, linesPerColumn } = layout.params;
  return {
    x: (page % pagesPerRow) * WORLD.pageWidth,
    y: Math.floor(page / pagesPerRow) * WORLD.pageHeight,
    w: columnsPerPage * columnWidth + (columnsPerPage - 1) * columnGap,
    h: linesPerColumn * lineHeight,
  };
}

export function columnRect(layout: Layout, page: number, column: number): Rect {
  const p = pageRect(layout, page);
  return { x: p.x + column * (columnWidth + columnGap), y: p.y, w: columnWidth, h: p.h };
}

/** 行在版面中的索引（行是連續排的） */
export const lineIndexOf = (layout: Layout, pos: LinePos): number => (pos.page * layout.params.columnsPerPage + pos.column) * layout.params.linesPerColumn + pos.line;

export function lineRect(layout: Layout, pos: LinePos): Rect {
  if (layout.lineRects) return layout.lineRects[lineIndexOf(layout, pos)]!;
  const c = columnRect(layout, pos.page, pos.column);
  return { x: c.x, y: c.y + pos.line * lineHeight, w: columnWidth, h: lineHeight };
}

/**
 * 頁面的排列（原型）：grid＝每列 6 頁；strip＝冊頁長卷，所有頁排成一列。
 * 只改世界中頁的擺放，不改版面（行、經節座標）。
 */
export type Arrangement = 'grid' | 'strip' | 'chapters';

/** 章節地圖：一欄幾行（比閱讀時的 16 行短，讓 16 章的列放得進一個畫面） */
export const MAP_COLUMN_LINES = 6;
const MAP_GUTTER = 6; // 左側章號欄寬（格）
const MAP_ROW_GAP = 1.75; // 列與列之間留一行

export function arrange(layout: Layout, a: Arrangement): Layout {
  const base: Layout = layout.lineRects ? withoutRects(layout) : layout;
  if (a === 'chapters') return chapterMap(base);
  const pagesPerRow = a === 'strip' ? Math.max(1, layout.pageCount) : DEFAULT_LAYOUT.pagesPerRow;
  return base === layout && layout.params.pagesPerRow === pagesPerRow ? layout : { ...base, params: { ...base.params, pagesPerRow } };
}

function withoutRects(layout: Layout): Layout {
  const copy = { ...layout };
  delete copy.lineRects;
  delete copy.bounds;
  delete copy.rows;
  return copy;
}

/**
 * 章節地圖（原型，書卷層用）：同一批行依章重排成一章一列——章號對齊在左側邊緣，
 * 列內一欄 MAP_COLUMN_LINES 行、欄由左往右，所以列的長度就是那一章的篇幅。
 * 章在這一層是「地址」（像目錄），精讀時的長卷仍不中斷。
 */
function chapterMap(layout: Layout): Layout {
  const lh = lineHeight;
  const rowH = MAP_COLUMN_LINES * lh;
  const step = columnWidth + columnGap;
  const rects: Array<{ x: number; y: number; w: number; h: number }> = new Array(layout.lines.length);
  const rows: Array<{ chapter: number; rect: { x: number; y: number; w: number; h: number } }> = [];
  let maxW = 0;
  layout.chapters.forEach((c, k) => {
    const end = layout.chapters[k + 1]?.line ?? layout.lines.length;
    const top = k * (rowH + MAP_ROW_GAP);
    rects[c.line] = { x: 0, y: top, w: MAP_GUTTER - 2, h: lh };
    const n = end - c.line - 1;
    for (let j = 0; j < n; j++) rects[c.line + 1 + j] = { x: MAP_GUTTER + Math.floor(j / MAP_COLUMN_LINES) * step, y: top + (j % MAP_COLUMN_LINES) * lh, w: columnWidth, h: lh };
    const w = MAP_GUTTER + Math.max(1, Math.ceil(n / MAP_COLUMN_LINES)) * step - columnGap;
    rows.push({ chapter: c.chapter, rect: { x: 0, y: top, w, h: rowH } });
    maxW = Math.max(maxW, w);
  });
  // 第一章之前若有行（理論上不會），排在第一列前面
  for (let i = 0; i < rects.length; i++) rects[i] ??= { x: MAP_GUTTER, y: 0, w: columnWidth, h: lh };
  const h = layout.chapters.length * (rowH + MAP_ROW_GAP) - MAP_ROW_GAP;
  return { ...layout, lineRects: rects, bounds: { x: 0, y: 0, w: maxW, h }, rows };
}

/** 本書頁面網格的外框 */
export function gridRect(layout: Layout): Rect {
  if (layout.bounds) return layout.bounds;
  const rows = Math.max(1, Math.ceil(layout.pageCount / layout.params.pagesPerRow));
  return { x: 0, y: 0, w: layout.params.pagesPerRow * WORLD.pageWidth, h: rows * WORLD.pageHeight };
}

/** 正典層級：66 卷依正典順序每列 11 卷；羅馬書方塊位於世界原點 */
export function bookTiles(layout: Layout): Array<{ book: number; rect: Rect }> {
  const g = gridRect(layout);
  const stepX = g.w + tileGap;
  const stepY = g.h + tileGap;
  const col0 = (ROMANS - 1) % BOOKS_PER_ROW;
  const row0 = Math.floor((ROMANS - 1) / BOOKS_PER_ROW);
  return Array.from({ length: 66 }, (_, i) => ({
    book: i + 1,
    rect: { x: ((i % BOOKS_PER_ROW) - col0) * stepX, y: (Math.floor(i / BOOKS_PER_ROW) - row0) * stepY, w: g.w, h: g.h },
  }));
}
