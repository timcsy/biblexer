// 守護：contracts/search-api.md 的 RRF 與段落聚合保證；原則 3
import { fc, test } from '@fast-check/vitest';
import { expect } from 'vitest';
import { aggregateToPassages, rrf } from '../../src/core/fusion.ts';

const list = fc.uniqueArray(fc.nat(30), { maxLength: 20 }).map((ids) => ids.map((id, i) => ({ id, score: 100 - i })));
const lists = fc.array(list, { minLength: 1, maxLength: 3 });

test.prop([lists])('rrf 輸出的 id 唯一，且遞減排列（同分 id 遞增）', (ls) => {
  const out = rrf(ls);
  expect(new Set(out.map((r) => r.id)).size).toBe(out.length);
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1]!, b = out[i]!;
    expect(a.score > b.score || (a.score === b.score && a.id < b.id)).toBe(true);
  }
});

test.prop([lists, fc.nat(2), fc.nat(19)])('某 id 在一個清單中名次提前，其融合名次不會變差', (ls, which, pos) => {
  const li = which % ls.length;
  const target = ls[li]!;
  if (target.length < 2) return;
  const from = pos % target.length;
  if (from === 0) return;
  const moved = [...target];
  const [item] = moved.splice(from, 1);
  moved.splice(from - 1, 0, item!);
  const before = rrf(ls).findIndex((r) => r.id === item!.id);
  const after = rrf(ls.map((l, i) => (i === li ? moved : l))).findIndex((r) => r.id === item!.id);
  expect(after).toBeLessThanOrEqual(before);
});

test.prop([list, fc.array(fc.nat(5), { minLength: 31, maxLength: 31 })])(
  'aggregateToPassages：passage id 唯一，分數取該段最高的單元',
  (units, mapping) => {
    const u2p = Int32Array.from(mapping);
    const out = aggregateToPassages(units, u2p);
    expect(new Set(out.map((r) => r.id)).size).toBe(out.length);
    for (const p of out) {
      const best = Math.max(...units.filter((u) => u2p[u.id] === p.id).map((u) => u.score));
      expect(p.score).toBe(best);
    }
  },
);
