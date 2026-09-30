import { fc, test } from '@fast-check/vitest';
import { expect } from 'vitest';
import { compareRefs, overlaps } from '../../src/core/refs.ts';

const range = fc.tuple(fc.nat(1000), fc.nat(1000)).map(([a, b]) => ({ start: Math.min(a, b), end: Math.max(a, b) }));
const ref = fc.record({ book: fc.integer({ min: 1, max: 66 }), chapter: fc.integer({ min: 1, max: 150 }), verse: fc.integer({ min: 1, max: 176 }) });

test.prop([range, range])('overlaps 對稱', (a, b) => {
  expect(overlaps(a, b)).toBe(overlaps(b, a));
});

test.prop([range])('overlaps 自反', (a) => {
  expect(overlaps(a, a)).toBe(true);
});

test.prop([range, range])('overlaps ⇔ 至少共有一節', (a, b) => {
  let shared = false;
  for (let i = a.start; i <= a.end; i++) if (i >= b.start && i <= b.end) shared = true;
  expect(overlaps(a, b)).toBe(shared);
});

test.prop([ref, ref])('compareRefs 反對稱', (a, b) => {
  expect(Math.sign(compareRefs(a, b))).toBe(-Math.sign(compareRefs(b, a)));
});
