// 守護：FR-022、research R8——書卷層的「章節地圖」——同一批行依章重排成一章一列，章號對齊在左側邊緣
import { describe, expect, test } from 'vitest';
import { cameraForVerse, createContext, landingPoints, placeAt, remap, tapTarget, zoomStep } from '../../src/reader/camera.ts';
import { layoutBook } from '../../src/reader/layout.ts';
import { MAP_COLUMN_LINES, WORLD, arrange, gridRect, lineRect } from '../../src/reader/world.ts';
import { sampleBook } from './reader-fixture.ts';

const base = layoutBook(sampleBook(16, 30));
const map = arrange(base, 'chapters');
const vp = { width: 1440, height: 800 };
const chapterOfLine = (i: number) => base.chapters.filter((c) => c.line <= i).at(-1)!.chapter;

describe('章節地圖排列', () => {
  test('版面不變：行與經節座標和原本相同', () => {
    expect(map.lines).toBe(base.lines);
    expect(map.verses).toBe(base.verses);
  });

  test('每一章一列：同一章的行都在同一列，列依章序由上往下', () => {
    const rows = new Map<number, { top: number; bottom: number }>();
    for (const l of base.lines) {
      const r = lineRect(map, l.pos);
      const ch = chapterOfLine(l.index);
      const row = rows.get(ch) ?? { top: Infinity, bottom: -Infinity };
      rows.set(ch, { top: Math.min(row.top, r.y), bottom: Math.max(row.bottom, r.y + r.h) });
    }
    const list = [...rows.entries()].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < list.length; i++) expect(list[i]![1].top).toBeGreaterThanOrEqual(list[i - 1]![1].bottom);
  });

  test('章號對齊在左側邊緣：所有章號標籤的 x 相同，且在經文行的左邊', () => {
    const xs = base.chapters.map((c) => lineRect(map, base.lines[c.line]!.pos).x);
    expect(new Set(xs).size).toBe(1);
    const textX = Math.min(...base.lines.filter((l) => !l.chapterStart).map((l) => lineRect(map, l.pos).x));
    expect(xs[0]!).toBeLessThan(textX);
  });

  test('每一塊＝一個段落：段落起點在那一塊的左上角（該列頂端），塊在前一塊的右邊並留縫', () => {
    for (const c of base.chapters) {
      const end = base.chapters.find((x) => x.chapter === c.chapter + 1)?.line ?? base.lines.length;
      const rowTop = lineRect(map, base.lines[c.line]!.pos).y;
      const starts = base.paragraphs.filter((p) => p.line > c.line && p.line < end);
      let prevRight = -Infinity;
      for (const p of starts) {
        const r = lineRect(map, base.lines[p.line]!.pos);
        expect(r.y).toBeCloseTo(rowTop, 9);
        expect(r.x).toBeGreaterThan(prevRight);
        const block = map.blocks!.find((b) => b.verseIdx === p.verseIdx)!;
        expect(block.rect.x).toBeCloseTo(r.x, 9);
        prevRight = block.rect.x + block.rect.w;
      }
    }
  });

  test('塊內依閱讀順序：以段落起點為第 0 行，一欄 MAP_COLUMN_LINES 行由上往下、欄由左往右；塊寬隨段落長度', () => {
    for (const p of base.paragraphs) {
      const next = base.lines.findIndex((l, i) => i > p.line && (l.paragraphStart || l.chapterStart));
      const end = next < 0 ? base.lines.length : next;
      const first = lineRect(map, base.lines[p.line]!.pos);
      for (let k = 0; p.line + k < end; k++) {
        const r = lineRect(map, base.lines[p.line + k]!.pos);
        expect(r.y).toBeCloseTo(first.y + (k % MAP_COLUMN_LINES) * WORLD.lineHeight, 9);
        expect(r.x).toBeCloseTo(first.x + Math.floor(k / MAP_COLUMN_LINES) * (WORLD.columnWidth + WORLD.columnGap), 9);
      }
      const block = map.blocks!.find((b) => b.verseIdx === p.verseIdx)!;
      expect(block.rect.w).toBeCloseTo(Math.ceil((end - p.line) / MAP_COLUMN_LINES) * (WORLD.columnWidth + WORLD.columnGap) - WORLD.columnGap, 9);
    }
  });

  test('外框包含所有行', () => {
    const g = gridRect(map);
    for (const l of base.lines) {
      const r = lineRect(map, l.pos);
      expect(r.x).toBeGreaterThanOrEqual(g.x);
      expect(r.x + r.w).toBeLessThanOrEqual(g.x + g.w + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(g.y + g.h + 1e-9);
    }
  });
});

describe('章節地圖上的相機', () => {
  const ctx = createContext(map, vp);

  test('點一塊（含塊內空白處）：進入那一段的精讀著陸點', () => {
    const c = placeAt(landingPoints(map, 'book')[0]!, ctx);
    const strip = createContext(arrange(base, 'strip'), vp);
    for (const b of map.blocks!.slice(0, 20)) {
      // 塊的右下角附近（短段落時那裡沒有行）
      const pt = { x: (b.rect.x + b.rect.w - 0.5 - c.x) * c.scale, y: (b.rect.y + b.rect.h - 0.5 - c.y) * c.scale };
      expect(tapTarget(c, pt, ctx)!.at).toBe(cameraForVerse(b.verseIdx, strip).at);
    }
  });

  test('書卷層：整張地圖放得進畫面時整張置中（不切開全貌），16 章都看得到', () => {
    const g = gridRect(map);
    for (const lp of landingPoints(map, 'book')) {
      const c = placeAt(lp, ctx);
      const vw = vp.width / c.scale;
      const vh = vp.height / c.scale;
      expect(g.h).toBeLessThan(vh);
      // 寬度放得下就水平置中；放不下就保住左側章號欄（留 16 px 邊距）
      if (g.w + 32 / c.scale <= vw) expect(c.x + vw / 2).toBeCloseTo(g.x + g.w / 2, 6);
      else expect((g.x - c.x) * c.scale).toBeCloseTo(16, 6);
      expect(c.y + vh / 2).toBeCloseTo(g.y + g.h / 2, 6);
      expect(c.at).toBe(lp.id);
    }
  });

  test('書卷層：放不下時（手機）保住左側章號欄，該章那一列在畫面上方', () => {
    const phone = createContext(map, { width: 390, height: 500 });
    const g = gridRect(map);
    for (const lp of landingPoints(map, 'book')) {
      const c = placeAt(lp, phone);
      // 章號欄（x = g.x）在畫面左緣之內
      expect(c.x).toBeLessThanOrEqual(g.x);
      const vh = 500 / c.scale;
      if (g.h + 32 / c.scale > vh) {
        const rowTop = lineRect(map, base.lines[lp.line!]!.pos).y;
        expect((rowTop - c.y) * c.scale).toBeCloseTo(16, 6);
      }
    }
  });

  test('從長卷的段落輪廓縮小到書卷層：換到章節地圖後停在同一章', () => {
    const strip = createContext(arrange(base, 'strip'), vp);
    const outline = zoomStep(cameraForVerse(300, strip), strip, -1);
    const book = zoomStep(outline, strip, -1);
    const m = remap(book, strip, ctx);
    expect(m.at).toBe(book.at);
    expect(m).toEqual(placeAt(landingPoints(map, 'book').find((p) => p.id === book.at)!, ctx, book.focus));
  });
});
