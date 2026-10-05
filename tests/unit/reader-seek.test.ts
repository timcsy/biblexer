// 原型：快速找到章節——縮小後點擊進入、拖動進度條（對應紙本的「按比例翻開、看頁眉、微調」）
import { describe, expect, test } from 'vitest';
import { cameraForVerse, createContext, landingPoints, placeAt, scrubTarget, tapTarget, zoomStep } from '../../src/reader/camera.ts';
import { layoutBook } from '../../src/reader/layout.ts';
import { arrange, lineRect } from '../../src/reader/world.ts';
import { sampleBook } from './reader-fixture.ts';

const sample = sampleBook(16, 30);
const base = layoutBook(sample);
const vp = { width: 1440, height: 800 };
const firstVerseOf = (ch: number) => sample.verses.findIndex((v) => v.ref.chapter === ch);

describe('縮小後點擊：以點到的那一行所在段落進入精讀', () => {
  for (const a of ['strip', 'grid'] as const) {
    const layout = arrange(base, a);
    const ctx = createContext(layout, vp);
    const toScreen = (c: { x: number; y: number; scale: number }, p: { x: number; y: number }) => ({ x: (p.x - c.x) * c.scale, y: (p.y - c.y) * c.scale });

    test(`書卷層點章號 → 該章開頭（${a}）`, () => {
      const book = landingPoints(layout, 'book').find((p) => p.id === 'chapter:45:8')!;
      const c = placeAt(book, ctx);
      const r = lineRect(layout, layout.lines[book.line!]!.pos);
      const t = tapTarget(c, toScreen(c, { x: r.x + 1, y: r.y + r.h / 2 }), ctx)!;
      expect(t).toEqual(cameraForVerse(firstVerseOf(8), ctx));
    });

    test(`段落輪廓點某一行 → 該行所在段落的精讀著陸點（${a}）`, () => {
      const outline = zoomStep(cameraForVerse(200, ctx), ctx, -1);
      const line = layout.lines.find((l) => l.cells.some((x) => x.verseIdx === 203))!;
      const r = lineRect(layout, line.pos);
      const t = tapTarget(outline, toScreen(outline, { x: r.x + 3, y: r.y + r.h / 2 }), ctx)!;
      const first = line.cells.find((x) => x.verseIdx !== null)!.verseIdx!;
      expect(t).toEqual(cameraForVerse(first, ctx));
    });

    test(`精讀層與點到空白處：不動作（${a}）`, () => {
      const c = cameraForVerse(0, ctx);
      expect(tapTarget(c, { x: 100, y: 100 }, ctx)).toBeNull();
      const book = placeAt(landingPoints(layout, 'book')[0]!, ctx);
      expect(tapTarget(book, { x: -5000, y: -5000 }, ctx)).toBeNull();
    });
  }
});

describe('拖動進度條', () => {
  const ctx = createContext(arrange(base, 'strip'), vp);

  test('最左端是第 1 章開頭；最右端是最後一頁', () => {
    expect(scrubTarget(0, ctx)).toMatchObject({ chapter: 1, page: 1 });
    expect(scrubTarget(1, ctx).page).toBe(base.pageCount);
  });

  test('拖到章的刻度附近：吸到那一章的開頭', () => {
    const t = scrubTarget(scrubTarget.tickOf(ctx, 8), ctx);
    expect(t.chapter).toBe(8);
    expect(t.camera).toEqual(cameraForVerse(firstVerseOf(8), ctx));
  });

  test('往右拖，頁數不會變小（單調），章數也不會變小', () => {
    let prev = { page: 0, chapter: 0 };
    for (let f = 0; f <= 1; f += 0.01) {
      const t = scrubTarget(f, ctx);
      expect(t.page).toBeGreaterThanOrEqual(prev.page);
      expect(t.chapter).toBeGreaterThanOrEqual(prev.chapter);
      prev = t;
    }
  });

  test('刻度位置依章在全書的比例，且依章序遞增', () => {
    const ticks = base.chapters.map((c) => scrubTarget.tickOf(ctx, c.chapter));
    expect(ticks[0]).toBe(0);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]!).toBeGreaterThan(ticks[i - 1]!);
  });
});
