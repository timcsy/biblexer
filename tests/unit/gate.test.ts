// 守護：history/004——驗收以「原句＋一次換說法」計；標為觀察指標（gate: false）的查詢不擋檢查點
import { describe, expect, test } from 'vitest';
import { gateQueries } from '../../bench/select.ts';

describe('檢查點查詢', () => {
  test('只計入 heldOut 為 false 且 gate 不為 false 的查詢', () => {
    const qs = [
      { id: 'a', heldOut: false },
      { id: 'b', heldOut: false, gate: false },
      { id: 'c', heldOut: true },
    ];
    expect(gateQueries(qs).map((q) => q.id)).toEqual(['a']);
  });
});
