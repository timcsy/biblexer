// 守護：research R3 選擇規則；FR-022（評測可重現）
import { describe, expect, test } from 'vitest';
import { MISS_RANK, buildReport, meanBestRank, selectArm } from '../../bench/select.ts';

const MB = 1024 * 1024;
const s = (armId: string, hits: number, mean: number, sizeMB: number) => ({ armId, hits, meanBestRank: mean, sizeBytes: sizeMB * MB });

describe('選擇規則', () => {
  test('先排除超過大小上限者，再比命中數', () => {
    const r = selectArm([s('big', 7, 1, 350), s('small', 7, 2, 30), s('mid', 6, 1, 100)], { sizeLimitBytes: 200 * MB, required: 7 });
    expect(r.selected).toBe('small');
  });

  test('命中數相同時比平均最佳名次，再比大小', () => {
    expect(selectArm([s('a', 7, 2.0, 30), s('b', 7, 1.5, 90)], { sizeLimitBytes: 200 * MB, required: 7 }).selected).toBe('b');
    expect(selectArm([s('a', 7, 1.5, 90), s('b', 7, 1.5, 30)], { sizeLimitBytes: 200 * MB, required: 7 }).selected).toBe('b');
  });

  test('沒有任何臂達到要求時 selected 為 null 並說明原因', () => {
    const r = selectArm([s('a', 6, 1, 30), s('b', 7, 1, 300)], { sizeLimitBytes: 200 * MB, required: 7 });
    expect(r.selected).toBeNull();
    expect(r.reason).toMatch(/7/);
  });

  test('平均最佳名次：未命中以 MISS_RANK 計', () => {
    expect(meanBestRank([1, 3, null])).toBeCloseTo((1 + 3 + MISS_RANK) / 3);
  });
});

describe('報告', () => {
  const input = {
    dataVersion: 'v1',
    arms: [{ id: 'b', model: 'm2' }, { id: 'a', model: 'm1' }],
    results: [
      { armId: 'b', queryId: 'q2', bestRank: 2 },
      { armId: 'a', queryId: 'q1', bestRank: null },
      { armId: 'a', queryId: 'q2', bestRank: 1 },
      { armId: 'b', queryId: 'q1', bestRank: 4 },
    ],
    summary: [s('b', 2, 3, 50), s('a', 1, 50.5, 20)],
    selected: 'b',
  };

  test('內容與輸入順序無關（排序後輸出），逐位元相同', () => {
    const shuffled = { ...input, arms: [...input.arms].reverse(), results: [...input.results].reverse(), summary: [...input.summary].reverse() };
    expect(buildReport(shuffled)).toBe(buildReport(input));
  });

  test('不含時間戳記；hitAtTop5 由 bestRank 推得', () => {
    const json = buildReport(input);
    expect(json).not.toMatch(/time|date/i);
    const parsed = JSON.parse(json) as { results: Array<{ armId: string; queryId: string; hitAtTop5: boolean }> };
    expect(parsed.results.find((r) => r.armId === 'b' && r.queryId === 'q1')?.hitAtTop5).toBe(true);
    expect(parsed.results.find((r) => r.armId === 'a' && r.queryId === 'q1')?.hitAtTop5).toBe(false);
  });
});
