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

export function lineRect(layout: Layout, pos: LinePos): Rect {
  const c = columnRect(layout, pos.page, pos.column);
  return { x: c.x, y: c.y + pos.line * lineHeight, w: columnWidth, h: lineHeight };
}

/** 本書頁面網格的外框 */
export function gridRect(layout: Layout): Rect {
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
