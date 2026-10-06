// 一層一層下去（使用者回饋 2026-10-06）：從書卷到章到段落到頁面，每一層都經過、停在含目標經節的那一處
import { describe, expect, test } from 'vitest';
import { createContext, descentStops, levelOf, type ZoomLevel } from '../../src/reader/camera.ts';
import { layoutBook } from '../../src/reader/layout.ts';
import { arrange } from '../../src/reader/world.ts';
import { sampleBook } from './reader-fixture.ts';

const book = sampleBook(16, 30);
const base = layoutBook(book);
const vp = { width: 1440, height: 800 };
const ctxs = { strip: createContext(arrange(base, 'strip'), vp), grid: createContext(arrange(base, 'grid'), vp), chapters: createContext(arrange(base, 'chapters'), vp) };
const ctxFor = (level: ZoomLevel) => (level === 'book' ? ctxs.chapters : level === 'canon' ? ctxs.grid : ctxs.strip);
// 第 3 章中間的一節
const target = book.verses.findIndex((v) => v.ref.chapter === 3 && v.ref.verse === 12);

describe('descentStops', () => {
  test('從正典層：書卷層（那一章）→ 段落輪廓（那一段）→ 精讀', () => {
    const stops = descentStops('canon', target, ctxFor);
    expect(stops.map((s) => s.level)).toEqual(['book', 'outline', 'reading']);
    expect(stops[0]!.camera.at).toBe(`chapter:${base.book}:3`);
    for (const s of stops) expect(levelOf(s.camera.scale, s.ctx.readingScale)).toBe(s.level);
    // 段落與精讀停在同一段（含目標經節的段落）
    const para = stops[1]!.camera.at!;
    expect(para).toMatch(/^para:/);
    expect(Number(para.slice(5))).toBeLessThanOrEqual(target);
    expect(stops[2]!.camera.at).toBe(para);
  });

  test('從書卷層只走剩下的：段落 → 精讀；從段落輪廓只剩精讀；已在精讀則沒有站', () => {
    expect(descentStops('book', target, ctxFor).map((s) => s.level)).toEqual(['outline', 'reading']);
    expect(descentStops('outline', target, ctxFor).map((s) => s.level)).toEqual(['reading']);
    expect(descentStops('reading', target, ctxFor)).toEqual([]);
  });
});
