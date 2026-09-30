// 語意向量：int8 量化（每向量一個縮放係數）與暴力內積（research R4；contracts vectors.bin）
//
// 向量在計算前已 L2 正規化，落在單位超球面上；內積即餘弦相似度（球面上的角距離）。
import { byScoreThenId, type Ranked } from './ranked.ts';

export interface VectorStore {
  count: number;
  dim: number;
  scales: Float32Array;
  data: Int8Array;
}

export function quantizeInt8(v: Float32Array): { q: Int8Array; scale: number } {
  let max = 0;
  for (const x of v) max = Math.max(max, Math.abs(x));
  const scale = max > 0 ? max / 127 : 1;
  const q = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) q[i] = Math.max(-127, Math.min(127, Math.round(v[i]! / scale)));
  return { q, scale };
}

export function buildVectorStore(vectors: readonly Float32Array[]): VectorStore {
  const dim = vectors[0]?.length ?? 0;
  const data = new Int8Array(vectors.length * dim);
  const scales = new Float32Array(vectors.length);
  vectors.forEach((v, i) => {
    if (v.length !== dim) throw new Error('向量維度不一致');
    const { q, scale } = quantizeInt8(v);
    data.set(q, i * dim);
    scales[i] = scale;
  });
  return { count: vectors.length, dim, scales, data };
}

export function dotInt8(query: Float32Array, store: VectorStore): Float32Array {
  const { count, dim, data, scales } = store;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let s = 0;
    const base = i * dim;
    for (let d = 0; d < dim; d++) s += query[d]! * data[base + d]!;
    out[i] = s * scales[i]!;
  }
  return out;
}

export function semanticSearch(query: Float32Array, store: VectorStore, topK: number): Ranked[] {
  const scores = dotInt8(query, store);
  const all: Ranked[] = Array.from(scores, (score, id) => ({ id, score }));
  return all.sort(byScoreThenId).slice(0, topK);
}

// vectors.bin：Uint32 count、Uint32 dim、Float32[count] scales、Int8[count×dim] data
export function serializeVectorStore(s: VectorStore): Uint8Array {
  const buf = new Uint8Array(8 + s.count * 4 + s.data.byteLength);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, s.count, true);
  dv.setUint32(4, s.dim, true);
  for (let i = 0; i < s.count; i++) dv.setFloat32(8 + i * 4, s.scales[i]!, true);
  buf.set(new Uint8Array(s.data.buffer, s.data.byteOffset, s.data.byteLength), 8 + s.count * 4);
  return buf;
}

export function deserializeVectorStore(bytes: Uint8Array): VectorStore {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = dv.getUint32(0, true);
  const dim = dv.getUint32(4, true);
  const scales = new Float32Array(count);
  for (let i = 0; i < count; i++) scales[i] = dv.getFloat32(8 + i * 4, true);
  const start = 8 + count * 4;
  const data = new Int8Array(bytes.slice(start, start + count * dim).buffer);
  return { count, dim, scales, data };
}
