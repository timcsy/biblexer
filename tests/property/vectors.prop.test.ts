// 守護：research R4（int8 量化）；原則 3
import { fc, test } from '@fast-check/vitest';
import { expect } from 'vitest';
import { buildVectorStore, deserializeVectorStore, dotInt8, quantizeInt8, semanticSearch, serializeVectorStore } from '../../src/core/vectors.ts';

const dim = 16;
const vec = fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: dim, maxLength: dim }).map((a) => Float32Array.from(a));
const vecs = fc.array(vec, { minLength: 1, maxLength: 20 });

test.prop([vec])('int8 量化誤差每維 ≤ scale/2', (v) => {
  const { q, scale } = quantizeInt8(v);
  for (let i = 0; i < dim; i++) expect(Math.abs(q[i]! * scale - v[i]!)).toBeLessThanOrEqual(scale / 2 + 1e-6);
});

test.prop([vecs, vec])('dotInt8 與 float32 內積的差距在量化誤差上界內', (vs, query) => {
  const store = buildVectorStore(vs);
  const scores = dotInt8(query, store);
  vs.forEach((v, i) => {
    let exact = 0, bound = 0;
    for (let d = 0; d < dim; d++) {
      exact += query[d]! * v[d]!;
      bound += Math.abs(query[d]!) * (store.scales[i]! / 2);
    }
    expect(Math.abs(scores[i]! - exact)).toBeLessThanOrEqual(bound + 1e-4);
  });
});

test.prop([vecs, vec, fc.integer({ min: 1, max: 30 })])('semanticSearch：遞減排列、id 唯一、長度 ≤ topK', (vs, query, k) => {
  const rs = semanticSearch(query, buildVectorStore(vs), k);
  expect(rs.length).toBeLessThanOrEqual(k);
  expect(new Set(rs.map((r) => r.id)).size).toBe(rs.length);
  for (let i = 1; i < rs.length; i++) expect(rs[i - 1]!.score).toBeGreaterThanOrEqual(rs[i]!.score);
});

test.prop([vecs])('vectors.bin 序列化後讀回相同', (vs) => {
  const store = buildVectorStore(vs);
  const back = deserializeVectorStore(serializeVectorStore(store));
  expect(back.dim).toBe(store.dim);
  expect(back.count).toBe(store.count);
  expect(Array.from(back.scales)).toEqual(Array.from(store.scales));
  expect(Array.from(back.data)).toEqual(Array.from(store.data));
});
