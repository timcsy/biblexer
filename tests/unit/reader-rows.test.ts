// 一章一列（使用者 2026-10-06「都做看看」；草稿〈層級過場的研究〉更好的做法 1）：
// 每一章從新的一頁開始、一章一列，書卷層到精讀全部同一種排列——下降時頁面位置完全不動（空間穩定）
import { describe, expect, test } from 'vitest';
import { LEVEL_SCALE, createContext, descentPace, landingPoints, levelOf, placeAt, zoomAbout } from '../../src/reader/camera.ts';
import { layoutBook } from '../../src/reader/layout.ts';
import { WORLD, arrange, gridRect, pageRect } from '../../src/reader/world.ts';
import { sampleBook } from './reader-fixture.ts';

const book = sampleBook(16, 30);
const per = (l: ReturnType<typeof layoutBook>) => l.params.columnsPerPage * l.params.linesPerColumn;

describe('每章從新的一頁開始（chapterPage）', () => {
  const plain = layoutBook(book);
  const paged = layoutBook(book, undefined, { chapterPage: true });
  test('每一章的章號標籤都在某一頁的第一行', () => {
    for (const c of paged.chapters) expect(c.line % per(paged)).toBe(0);
  });
  test('經文內容不變（同樣的經節、同樣的段落與章數），只是頁數變多', () => {
    expect(paged.verses.length).toBe(plain.verses.length);
    expect(paged.paragraphs.length).toBe(plain.paragraphs.length);
    expect(paged.chapters.length).toBe(plain.chapters.length);
    expect(paged.pageCount).toBeGreaterThanOrEqual(plain.pageCount);
    // 行的索引連續、與 pos 一致（補上的是空行）
    paged.lines.forEach((l, i) => expect(l.index).toBe(i));
  });
});

describe('一章一列的排列（rows）', () => {
  const paged = layoutBook(book, undefined, { chapterPage: true });
  const rows = arrange(paged, 'rows');
  test('每一章一列：章的第一頁在該列最左邊，同一章的頁由左往右', () => {
    rows.chapters.forEach((c, k) => {
      const first = rows.lines[c.line]!.pos.page;
      expect(pageRect(rows, first).x).toBe(0);
      expect(pageRect(rows, first).y).toBe(k * WORLD.pageHeight);
      const next = rows.chapters[k + 1] ? rows.lines[rows.chapters[k + 1]!.line]!.pos.page : rows.pageCount;
      for (let p = first + 1; p < next; p++) {
        expect(pageRect(rows, p).y).toBe(k * WORLD.pageHeight);
        expect(pageRect(rows, p).x).toBe(pageRect(rows, p - 1).x + WORLD.pageWidth);
      }
    });
  });
  test('外框：寬＝最長那一章的頁數，高＝章數', () => {
    const g = gridRect(rows);
    expect(g.h).toBe(rows.chapters.length * WORLD.pageHeight);
    expect(g.w % WORLD.pageWidth).toBe(0);
  });
});

describe('以目標為中心縮放（zoomAbout）', () => {
  const ctx = createContext(arrange(layoutBook(book, undefined, { chapterPage: true }), 'rows'), { width: 1440, height: 800 });
  const P = { x: WORLD.pageWidth * 1.2, y: WORLD.pageHeight * 7.3 };
  const a = { x: P.x - 600 / (ctx.readingScale * 0.15), y: P.y - 300 / (ctx.readingScale * 0.15), scale: ctx.readingScale * 0.15 };
  const b = { x: P.x - 200 / ctx.readingScale, y: P.y - 100 / ctx.readingScale, scale: ctx.readingScale, at: 'para:0' };
  const z = zoomAbout(a, b, P, ctx);
  test('起點、終點恰為兩端；比例單調變化', () => {
    expect(z.at(0).scale).toBeCloseTo(a.scale, 9);
    expect(z.at(1)).toEqual(b);
    let prev = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      const s = z.at(t).scale;
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
  test('目標點在整段過程中都留在畫面上，位置在兩端之間平滑移動', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const c = z.at(t);
      const sx = (P.x - c.x) * c.scale;
      const sy = (P.y - c.y) * c.scale;
      expect(sx).toBeGreaterThanOrEqual(199.99);
      expect(sx).toBeLessThanOrEqual(600.01);
      expect(sy).toBeGreaterThanOrEqual(99.99);
      expect(sy).toBeLessThanOrEqual(300.01);
    }
  });
  test('跨層級時與一般飛行同樣放慢（至少 1.1 秒）', () => {
    expect(levelOf(a.scale, ctx.readingScale)).not.toBe(levelOf(b.scale, ctx.readingScale));
    expect(z.duration).toBeGreaterThanOrEqual(1100);
  });
});

describe('依熟悉度調整速度（descentPace）', () => {
  test('前 3 次完整（1）；之後逐漸加快；最快 0.35', () => {
    expect([0, 1, 2].map(descentPace)).toEqual([1, 1, 1]);
    expect(descentPace(4)).toBeLessThan(descentPace(3));
    expect(descentPace(100)).toBe(0.35);
    for (let n = 0; n < 30; n++) expect(descentPace(n + 1)).toBeLessThanOrEqual(descentPace(n));
  });
});

describe('一章一列的書卷層：盡量放下整卷（2026-10-07）', () => {
  const rows = arrange(layoutBook(book, undefined, { chapterPage: true }), 'rows');
  const ctx = createContext(rows, { width: 1440, height: 800 });
  const lp = landingPoints(rows, 'book')[7]!;
  const cam = placeAt(lp, ctx);
  test('比例比標準書卷層小（看得到更多列），但仍在書卷層的範圍內', () => {
    expect(cam.scale).toBeLessThan(LEVEL_SCALE.book * ctx.readingScale);
    expect(levelOf(cam.scale, ctx.readingScale)).toBe('book');
    expect(cam.scale).toBeGreaterThanOrEqual(0.065 * ctx.readingScale - 1e-12);
  });
  test('放得下時整卷都在畫面上；放不下時至少看得到比標準比例多的列', () => {
    const g = gridRect(rows);
    const visibleRows = ctx.viewport.height / cam.scale / WORLD.pageHeight;
    const standardRows = ctx.viewport.height / (LEVEL_SCALE.book * ctx.readingScale) / WORLD.pageHeight;
    if (g.h * cam.scale <= ctx.viewport.height) {
      expect(cam.y).toBeLessThanOrEqual(g.y);
      expect(cam.y + ctx.viewport.height / cam.scale).toBeGreaterThanOrEqual(g.y + g.h);
    } else expect(visibleRows).toBeGreaterThan(standardRows);
  });
  test('其他排列的書卷層不受影響', () => {
    const grid = arrange(layoutBook(book), 'grid');
    const g = createContext(grid, { width: 1440, height: 800 });
    expect(placeAt(landingPoints(grid, 'book')[0]!, g).scale).toBe(LEVEL_SCALE.book * g.readingScale);
  });
});
