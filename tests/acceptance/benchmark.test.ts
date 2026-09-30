// 守護：SC-001、FR-023——選定臂的 7 個固定查詢須全部在前 5 名命中
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { evaluateManifestArm } from '../../bench/lib.ts';

test('7 個固定驗收查詢全部命中前 5 名', async () => {
  const results = await evaluateManifestArm(join(import.meta.dirname, '../../public'));
  const acceptance = results.filter((r) => !r.heldOut);
  expect(acceptance).toHaveLength(7);
  const misses = acceptance.filter((r) => r.bestRank === null || r.bestRank > 5).map((r) => `${r.queryId}（最佳名次 ${r.bestRank ?? '無'}）`);
  expect(misses, `未命中：${misses.join('、')}`).toEqual([]);
});
