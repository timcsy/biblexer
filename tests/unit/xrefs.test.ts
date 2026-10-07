// 守護：spec 004 FR-007、FR-008、Edge Cases——參照表的編碼與查詢
import { describe, expect, test } from 'vitest';
import { decodeXrefs, encodeXrefs, xrefsForPassage } from '../../src/core/xrefs.ts';

describe('參照表', () => {
  // 10 節：第 2 節 → [7,8]、[3,3]；第 3 節 → [7,8]（重複）、[0,0]；第 4 節 → [2,2]（落在段落內）
  const perVerse: Array<Array<[number, number]>> = [[], [], [[7, 8], [3, 3]], [[7, 8], [0, 0]], [[2, 2]], [], [], [], [], []];
  const table = decodeXrefs(encodeXrefs(perVerse).buffer);

  test('編碼後解碼還原每一節的目標範圍（依原順序）', () => {
    expect(table.verseCount).toBe(10);
    for (let v = 0; v < 10; v++) expect(table.targets(v)).toEqual(perVerse[v]);
  });

  test('一段（第 2～4 節）的參照：依節的順序、各節內依原順序；去除重複；與段落重疊的不列', () => {
    expect(xrefsForPassage(table, 2, 4)).toEqual([
      [7, 8],
      [0, 0],
    ]);
  });

  test('超出範圍的節回空', () => {
    expect(table.targets(99)).toEqual([]);
  });
});
