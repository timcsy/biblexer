// 守護：bench/distortion.ts——版面對「順序距離」與「結構距離」的失真度量（混合曲率草稿的第一個可算實驗）
import { describe, expect, test } from 'vitest';
import { neighborPrecision, paragraphPoints, seqDistance, spearman, treeDistance, type ParaPoint } from '../../bench/distortion.ts';
import { layoutBook } from '../../src/reader/layout.ts';
import { arrange } from '../../src/reader/world.ts';
import { sampleBook } from './reader-fixture.ts';

const pt = (i: number, chapter: number, x: number, y = 0): ParaPoint => ({ index: i, line: i * 10, chapter, x, y });

describe('距離', () => {
  test('順序距離＝相隔的行數', () => {
    expect(seqDistance(pt(1, 1, 0), pt(4, 1, 0))).toBe(30);
  });

  test('結構距離（樹）：同一段 0、同章不同段 2、不同章 4', () => {
    expect(treeDistance(pt(1, 1, 0), pt(1, 1, 0))).toBe(0);
    expect(treeDistance(pt(1, 1, 0), pt(2, 1, 0))).toBe(2);
    expect(treeDistance(pt(1, 1, 0), pt(2, 2, 0))).toBe(4);
  });
});

describe('Spearman 等級相關', () => {
  test('單調遞增為 1、遞減為 -1', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 12);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 12);
  });

  test('平手取平均等級', () => {
    // x 的等級 [1.5, 1.5, 3]；y 的等級 [1, 2, 3]
    expect(spearman([5, 5, 9], [1, 2, 3])).toBeCloseTo(0.8660254, 6);
  });
});

describe('鄰居保留率', () => {
  test('兩章在版面上分得很開：結構鄰居全中', () => {
    const pts = [pt(0, 1, 0), pt(1, 1, 1), pt(2, 1, 2), pt(3, 2, 100), pt(4, 2, 101), pt(5, 2, 102)];
    expect(neighborPrecision(pts, 'tree')).toBeCloseTo(1, 12);
    // 第一章最後一段的閱讀鄰居（第二章第一段）在版面上很遠：順序鄰居不會全中
    expect(neighborPrecision(pts, 'seq')).toBeLessThan(1);
  });

  test('等距排成一列：順序鄰居全中', () => {
    const pts = [0, 1, 2, 3, 4, 5].map((i) => pt(i, 1, i * 7));
    expect(neighborPrecision(pts, 'seq')).toBeCloseTo(1, 12);
  });

  test('兩章交錯排列：結構鄰居大多落空', () => {
    const pts = [pt(0, 1, 0), pt(1, 2, 1), pt(2, 1, 2), pt(3, 2, 3)];
    expect(neighborPrecision(pts, 'tree')).toBeLessThan(0.5);
  });
});

describe('從版面取段落位置', () => {
  test('每個段落一點，依閱讀順序；不同排列只改 x、y', () => {
    const base = layoutBook(sampleBook(4, 20));
    const a = paragraphPoints(arrange(base, 'strip'));
    const b = paragraphPoints(arrange(base, 'chapters'));
    expect(a.length).toBe(base.paragraphs.length);
    expect(a.map((p) => [p.index, p.line, p.chapter])).toEqual(b.map((p) => [p.index, p.line, p.chapter]));
    expect(a.map((p) => p.x)).not.toEqual(b.map((p) => p.x));
  });
});
