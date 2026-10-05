// 守護：data-model「World」（版面 → 世界座標；正典方塊）
import { describe, expect, test } from 'vitest';
import { DEFAULT_LAYOUT, layoutBook, type BookVerse } from '../../src/reader/layout.ts';
import { WORLD, bookTiles, lineRect, pageRect } from '../../src/reader/world.ts';

const han = (n: number) => '甲乙丙丁戊己庚辛壬癸'.repeat(Math.ceil(n / 10)).slice(0, n);
const verse: BookVerse = { ref: { book: 45, chapter: 1, verse: 1 }, parts: [{ kind: 'text', value: han(18 * 16 * 2 * 8) }], merged: false };
const layout = layoutBook({ book: 45, verses: [verse], paragraphStarts: [0] });
const { pagesPerRow, linesPerColumn } = DEFAULT_LAYOUT;

describe('正典方塊以目前書卷為原點（spec 005 FR-001）', () => {
  test('創世記：第 1 卷的方塊在原點；羅馬書：第 45 卷的方塊在原點', () => {
    for (const book of [1, 45]) {
      const l = layoutBook({ book, verses: [{ ...verse, ref: { book, chapter: 1, verse: 1 } }], paragraphStarts: [0] });
      expect(bookTiles(l)[book - 1]!.rect).toMatchObject({ x: 0, y: 0 });
    }
  });
});

describe('世界座標', () => {
  test('頁 p 的左上角：x = (p mod 6) × pageWidth，y = floor(p / 6) × pageHeight', () => {
    expect(layout.pageCount).toBeGreaterThan(pagesPerRow);
    for (const p of [0, 1, 5, 6, 7]) {
      expect(pageRect(layout, p)).toMatchObject({ x: (p % pagesPerRow) * WORLD.pageWidth, y: Math.floor(p / pagesPerRow) * WORLD.pageHeight });
    }
  });

  test('同頁兩欄左右相鄰、同高；行依序往下', () => {
    const a = lineRect(layout, { page: 0, column: 0, line: 0 });
    const b = lineRect(layout, { page: 0, column: 1, line: 0 });
    const c = lineRect(layout, { page: 0, column: 0, line: 1 });
    expect(b.y).toBe(a.y);
    expect(b.x).toBe(a.x + WORLD.columnWidth + WORLD.columnGap);
    expect(c.y).toBe(a.y + WORLD.lineHeight);
    expect(lineRect(layout, { page: 0, column: 0, line: linesPerColumn - 1 }).y + WORLD.lineHeight).toBeLessThanOrEqual(pageRect(layout, 0).y + pageRect(layout, 0).h);
  });

  test('正典方塊：66 卷依正典順序每列 11 卷，同大；羅馬書方塊等於其頁面網格外框', () => {
    const tiles = bookTiles(layout);
    expect(tiles.map((t) => t.book)).toEqual(Array.from({ length: 66 }, (_, i) => i + 1));
    const romans = tiles[44]!.rect;
    const rows = Math.ceil(layout.pageCount / pagesPerRow);
    expect(romans).toEqual({ x: 0, y: 0, w: pagesPerRow * WORLD.pageWidth, h: rows * WORLD.pageHeight });
    for (const t of tiles) expect([t.rect.w, t.rect.h]).toEqual([romans.w, romans.h]);
    // 同一列相鄰、下一列在下方
    expect(tiles[45]!.rect.x).toBeGreaterThan(romans.x);
    expect(tiles[45]!.rect.y).toBe(romans.y);
    expect(tiles[55]!.rect.y).toBeGreaterThan(romans.y);
    expect(tiles[43]!.rect.y).toBeLessThan(romans.y);
  });
});
