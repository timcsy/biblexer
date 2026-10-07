// 守護：spec 006 FR-001、FR-002——記號的切換、查詢、序列化
import { describe, expect, test } from 'vitest';
import { deserializeMarks, hasMark, marksInBook, serializeMarks, toggleMark } from '../../src/core/marks.ts';

const r828 = { book: 45, chapter: 8, verse: 28 };
const r117 = { book: 45, chapter: 1, verse: 17 };

describe('記號', () => {
  test('切換：加上再取消；同一節不重複', () => {
    let m = toggleMark([], r828);
    expect(hasMark(m, r828)).toBe(true);
    m = toggleMark(m, r117);
    expect(m).toHaveLength(2);
    m = toggleMark(m, r828);
    expect(hasMark(m, r828)).toBe(false);
    expect(m).toHaveLength(1);
  });

  test('序列化後還原；壞資料、空值回空', () => {
    const m = toggleMark(toggleMark([], r828), r117);
    expect(deserializeMarks(serializeMarks(m))).toEqual(m);
    expect(deserializeMarks(null)).toEqual([]);
    expect(deserializeMarks('不是 JSON')).toEqual([]);
    expect(deserializeMarks('[["x"],[45,8,28]]')).toEqual([r828]);
  });

  test('某一卷的記號', () => {
    const m = toggleMark(toggleMark([], r828), { book: 1, chapter: 50, verse: 20 });
    expect(marksInBook(m, 45)).toEqual([r828]);
  });
});
