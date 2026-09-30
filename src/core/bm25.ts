// BM25 關鍵字檢索（research R5；contracts/data-artifacts.md keyword.bin）
import { byScoreThenId, type Ranked } from './ranked.ts';
import { tokenize } from './tokenize.ts';

export interface KeywordIndex {
  numDocs: number;
  avgLen: number;
  k1: number;
  b: number;
  /** 排序後的 token */
  terms: string[];
  /** terms[t] 的 postings 位於 [offsets[t], offsets[t+1]) */
  offsets: Uint32Array;
  docIds: Uint32Array;
  tfs: Uint16Array;
  docLen: Uint32Array;
}

export function buildKeywordIndex(docs: readonly string[], k1 = 1.2, b = 0.75): KeywordIndex {
  const postings = new Map<string, Map<number, number>>();
  const docLen = new Uint32Array(docs.length);
  docs.forEach((d, id) => {
    const toks = tokenize(d);
    docLen[id] = toks.length;
    for (const t of toks) {
      let m = postings.get(t);
      if (!m) postings.set(t, (m = new Map()));
      m.set(id, (m.get(id) ?? 0) + 1);
    }
  });
  const terms = [...postings.keys()].sort();
  const offsets = new Uint32Array(terms.length + 1);
  let total = 0;
  terms.forEach((t, i) => {
    offsets[i] = total;
    total += postings.get(t)!.size;
  });
  offsets[terms.length] = total;
  const docIds = new Uint32Array(total);
  const tfs = new Uint16Array(total);
  terms.forEach((t, i) => {
    let o = offsets[i]!;
    for (const [id, tf] of [...postings.get(t)!].sort((x, y) => x[0] - y[0])) {
      docIds[o] = id;
      tfs[o] = Math.min(tf, 0xffff);
      o++;
    }
  });
  const sumLen = docLen.reduce((a, x) => a + x, 0);
  return { numDocs: docs.length, avgLen: docs.length ? sumLen / docs.length : 0, k1, b, terms, offsets, docIds, tfs, docLen };
}

function findTerm(terms: readonly string[], t: string): number {
  let lo = 0, hi = terms.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const m = terms[mid]!;
    if (m === t) return mid;
    if (m < t) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

export function bm25Search(idx: KeywordIndex, query: string, topK: number): Ranked[] {
  const scores = new Map<number, number>();
  const { numDocs: N, avgLen, k1, b } = idx;
  // 查詢含兩字以上的詞段時只用 bigram：中文的意義單位至少是兩字，
  // 單字（的、很、人…）在口語查詢中幾乎全是雜訊；單字查詢（如「愛」）才用 unigram。
  const all = tokenize(query);
  const bigrams = all.filter((t) => [...t].length >= 2);
  for (const t of new Set(bigrams.length ? bigrams : all)) {
    const ti = findTerm(idx.terms, t);
    if (ti < 0) continue;
    const from = idx.offsets[ti]!, to = idx.offsets[ti + 1]!;
    const df = to - from;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    for (let o = from; o < to; o++) {
      const id = idx.docIds[o]!;
      const tf = idx.tfs[o]!;
      const norm = tf + k1 * (1 - b + (b * idx.docLen[id]!) / (avgLen || 1));
      scores.set(id, (scores.get(id) ?? 0) + idf * ((tf * (k1 + 1)) / norm));
    }
  }
  return [...scores].map(([id, score]) => ({ id, score })).sort(byScoreThenId).slice(0, topK);
}

// ---- 序列化（keyword.bin） ----
// 標頭 Float64×4：numDocs, avgLen, k1, b；Uint32×2：numTerms, numPostings, termBytes
// 之後依序：termBytes（UTF-8，以 \n 分隔）、offsets、docIds、tfs（Uint16，補齊到 4 位元組）、docLen

export function serializeKeywordIndex(idx: KeywordIndex): Uint8Array {
  const termBytes = new TextEncoder().encode(idx.terms.join('\n'));
  const pad4 = (n: number) => (n + 3) & ~3;
  const header = 8 * 4 + 4 * 3;
  const size =
    header + pad4(termBytes.byteLength) + idx.offsets.byteLength + idx.docIds.byteLength + pad4(idx.tfs.byteLength) + idx.docLen.byteLength;
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  let o = 0;
  for (const x of [idx.numDocs, idx.avgLen, idx.k1, idx.b]) {
    dv.setFloat64(o, x, true);
    o += 8;
  }
  for (const x of [idx.terms.length, idx.docIds.length, termBytes.byteLength]) {
    dv.setUint32(o, x, true);
    o += 4;
  }
  buf.set(termBytes, o);
  o += pad4(termBytes.byteLength);
  const putU32 = (a: Uint32Array) => {
    for (const x of a) {
      dv.setUint32(o, x, true);
      o += 4;
    }
  };
  putU32(idx.offsets);
  putU32(idx.docIds);
  for (const x of idx.tfs) {
    dv.setUint16(o, x, true);
    o += 2;
  }
  o = pad4(o);
  putU32(idx.docLen);
  return buf;
}

export function deserializeKeywordIndex(bytes: Uint8Array): KeywordIndex {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pad4 = (n: number) => (n + 3) & ~3;
  let o = 0;
  const f = () => {
    const x = dv.getFloat64(o, true);
    o += 8;
    return x;
  };
  const u = () => {
    const x = dv.getUint32(o, true);
    o += 4;
    return x;
  };
  const numDocs = f(), avgLen = f(), k1 = f(), b = f();
  const numTerms = u(), numPostings = u(), termBytes = u();
  const termStr = new TextDecoder().decode(bytes.subarray(o, o + termBytes));
  const terms = numTerms ? termStr.split('\n') : [];
  o += pad4(termBytes);
  const readU32 = (n: number) => {
    const a = new Uint32Array(n);
    for (let i = 0; i < n; i++) a[i] = u();
    return a;
  };
  const offsets = readU32(numTerms + 1);
  const docIds = readU32(numPostings);
  const tfs = new Uint16Array(numPostings);
  for (let i = 0; i < numPostings; i++) {
    tfs[i] = dv.getUint16(o, true);
    o += 2;
  }
  o = pad4(o);
  const docLen = readU32(numDocs);
  return { numDocs, avgLen, k1, b, terms, offsets, docIds, tfs, docLen };
}
