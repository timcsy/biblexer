// 原型（prototype-strip）：冊頁長卷的排列、排列切換時的相機換算、過場路徑
import { describe, expect, test } from 'vitest';
import { cameraForVerse, createContext, flyPath, landingPoints, placeAt, remap, zoomStep } from '../../src/reader/camera.ts';
import { layoutBook } from '../../src/reader/layout.ts';
import { WORLD, arrange, gridRect, pageRect } from '../../src/reader/world.ts';
import { sampleBook } from './reader-fixture.ts';

const base = layoutBook(sampleBook(16, 30));
const strip = arrange(base, 'strip');
const grid = arrange(base, 'grid');
const vp = { width: 1440, height: 800 };

describe('排列', () => {
  test('長卷：所有頁在同一列，由左往右；格狀：每列 6 頁', () => {
    expect(base.pageCount).toBeGreaterThan(6);
    for (let p = 1; p < strip.pageCount; p++) {
      expect(pageRect(strip, p).y).toBe(0);
      expect(pageRect(strip, p).x).toBeGreaterThan(pageRect(strip, p - 1).x);
    }
    expect(pageRect(grid, 6).y).toBeGreaterThan(0);
  });

  test('排列不改變版面：行、經節座標完全相同', () => {
    expect(strip.lines).toBe(base.lines);
    expect(strip.verses).toBe(base.verses);
    expect(grid.verses).toBe(base.verses);
  });
});

describe('排列切換時的相機換算', () => {
  test('視窗中心所在的頁，切換前後在螢幕上的位置不變；著陸點與 focus 保留', () => {
    const from = createContext(strip, vp);
    const to = createContext(grid, vp);
    const c = cameraForVerse(300, from);
    const m = remap(c, from, to);
    expect(m).toMatchObject({ at: c.at, focus: c.focus, scale: c.scale });
    // 找出中心所在頁，比較該頁左上角的螢幕座標
    const cx = c.x + vp.width / (2 * c.scale);
    const p = [...Array(strip.pageCount).keys()].find((k) => {
      const r = pageRect(strip, k);
      return cx >= r.x - 4 && cx <= r.x + r.w + 4;
    })!;
    const screen = (cam: typeof c, l: typeof strip) => [(pageRect(l, p).x - cam.x) * cam.scale, (pageRect(l, p).y - cam.y) * cam.scale];
    const [a, b] = [screen(c, strip), screen(m, grid)];
    expect(b[0]).toBeCloseTo(a[0]!, 6);
    expect(b[1]).toBeCloseTo(a[1]!, 6);
  });

  test('停在著陸點上（如書卷層的章）：在新的排列中放到同一個著陸點', () => {
    const from = createContext(strip, vp);
    const to = createContext(grid, vp);
    // 精讀 → 段落輪廓 → 書卷：在長卷中算出的書卷層著陸點
    const book = zoomStep(zoomStep(cameraForVerse(300, from), from, -1), from, -1);
    expect(book.at).toMatch(/^chapter:/);
    const m = remap(book, from, to);
    const lp = landingPoints(grid, 'book').find((p) => p.id === book.at)!;
    expect(m).toEqual(placeAt(lp, to, book.focus));
  });

  test('相同排列之間換算是恆等', () => {
    const ctx = createContext(grid, vp);
    const c = cameraForVerse(100, ctx);
    expect(remap(c, ctx, ctx)).toEqual(c);
  });
});

describe('過場路徑（van Wijk 與 Nuij）', () => {
  const ctx = createContext(strip, vp);
  const a = cameraForVerse(0, ctx);
  const b = cameraForVerse(400, ctx);

  test('起點是原相機、終點恰為目標（含著陸點與 focus）', () => {
    const f = flyPath(a, b, ctx);
    const s = f.at(0);
    expect(s.x).toBeCloseTo(a.x, 6);
    expect(s.y).toBeCloseTo(a.y, 6);
    expect(s.scale).toBeCloseTo(a.scale, 6);
    expect(f.at(1)).toEqual(b);
  });

  test('遠距離時中途先拉遠（比例比兩端都小）；時間有上下限', () => {
    const f = flyPath(a, b, ctx);
    expect(f.at(0.5).scale).toBeLessThan(Math.min(a.scale, b.scale));
    expect(f.duration).toBeGreaterThanOrEqual(180);
    expect(f.duration).toBeLessThanOrEqual(700);
  });

  test('只換比例（同一中心）也能平順內插', () => {
    // 中心不變、比例減半
    const k = 0.5;
    const z = { x: a.x + (vp.width / (2 * a.scale)) * (1 - 1 / k), y: a.y + (vp.height / (2 * a.scale)) * (1 - 1 / k), scale: a.scale * k };
    const f = flyPath(a, z, ctx);
    const mid = f.at(0.5).scale;
    expect(mid).toBeLessThan(a.scale);
    expect(mid).toBeGreaterThan(z.scale);
  });
});

describe('書卷層：看全貌', () => {
  test('整個網格放得進視窗時整個置中；否則垂直對齊章所在那一列的頂端', () => {
    const ctx = createContext(grid, vp);
    for (const lp of landingPoints(grid, 'book')) {
      const c = placeAt(lp, ctx);
      const g = gridRect(grid);
      const vw = vp.width / c.scale;
      expect(g.w + 120 / c.scale).toBeLessThan(vw);
      // 置中的是「左側章號欄（120 px）＋網格」
      expect(c.x + vw / 2).toBeCloseTo(g.x + g.w / 2 - 60 / c.scale, 6);
      const vh = vp.height / c.scale;
      if (g.h + 32 / c.scale <= vh) expect(c.y + vh / 2).toBeCloseTo(g.y + g.h / 2, 6);
      else {
        const page = grid.lines[lp.line!]!.pos.page;
        const rowTop = Math.floor(page / grid.params.pagesPerRow) * WORLD.pageHeight;
        expect(c.y).toBeLessThanOrEqual(rowTop);
        expect(c.y).toBeGreaterThan(rowTop - WORLD.pageHeight / 2);
      }
    }
  });
});
