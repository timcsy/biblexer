// 守護：spec 004 FR-001、FR-002（排除同章與自身；只回順序、不回分數）
import { describe, expect, test } from 'vitest';
import { parallels } from '../../src/core/parallels.ts';
import { buildCorpus, type CorpusUnit } from '../../src/core/search.ts';

const norm = (v: number[]) => {
  const n = Math.hypot(...v);
  return Float32Array.from(v, (x) => x / n);
};
const verse = (chapter: number, v: number) => ({ book: 45, chapter, verse: v, searchText: `${chapter}${v}` });
// 第 1 章：A（0–1）、D（2–3）；第 2 章：B（4–5）；第 3 章：C（6–7）、E（8–9）
const verses = [verse(1, 1), verse(1, 2), verse(1, 3), verse(1, 4), verse(2, 1), verse(2, 2), verse(3, 1), verse(3, 2), verse(3, 3), verse(3, 4)];
const passages = [
  { start: 0, end: 1 },
  { start: 2, end: 3 },
  { start: 4, end: 5 },
  { start: 6, end: 7 },
  { start: 8, end: 9 },
];
const dir = [norm([1, 0, 0, 0]), norm([1, 0, 0, 0]), norm([0.9, 0.1, 0, 0]), norm([0.4, 0.6, 0, 0]), norm([0, 0, 1, 0])];
const corpus = buildCorpus({ verses, passages, vectors: (units: readonly CorpusUnit[]) => units.map((u) => dir[u.passageId]!) });

describe('語意近鄰串珠', () => {
  test('依相似度排序，排除自身與同一章（D 與 A 向量相同但同章）', () => {
    expect(parallels(corpus, 0, 8)).toEqual([2, 3, 4]);
  });

  test('只回段落 id（順序），不回分數', () => {
    for (const x of parallels(corpus, 2, 8)) expect(Number.isInteger(x)).toBe(true);
  });

  test('k 為上限', () => {
    expect(parallels(corpus, 0, 2)).toEqual([2, 3]);
  });

  test('沒有語意向量時回空', () => {
    const noVec = buildCorpus({ verses, passages, vectors: null });
    expect(parallels(noVec, 0, 8)).toEqual([]);
  });
});
