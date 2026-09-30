// 守護：contracts/search-api.md 的 BM25 保證；原則 3（數學名詞有函式與性質測試）
import { fc, test } from '@fast-check/vitest';
import { expect } from 'vitest';
import { bm25Search, buildKeywordIndex, deserializeKeywordIndex, serializeKeywordIndex } from '../../src/core/bm25.ts';

const hanChar = fc.constantFrom(...'神愛信望恩典羊牧人耶穌基督天國的了在'.split(''));
const doc = fc.array(hanChar, { minLength: 1, maxLength: 30 }).map((a) => a.join(''));
const docs = fc.array(doc, { minLength: 1, maxLength: 25 });
const query = fc.array(hanChar, { minLength: 1, maxLength: 5 }).map((a) => a.join(''));

test.prop([docs, query])('沒有任何共同 token 的文件不出現在結果中', (ds, q) => {
  const idx = buildKeywordIndex(ds);
  const qChars = new Set(q);
  for (const r of bm25Search(idx, q, 100)) {
    expect([...ds[r.id]!].some((c) => qChars.has(c))).toBe(true);
  }
});

test.prop([docs, query])('結果依分數遞減，同分以 id 遞增，分數為正', (ds, q) => {
  const rs = bm25Search(buildKeywordIndex(ds), q, 100);
  for (let i = 1; i < rs.length; i++) {
    const a = rs[i - 1]!, b = rs[i]!;
    expect(a.score > b.score || (a.score === b.score && a.id < b.id)).toBe(true);
  }
  for (const r of rs) expect(r.score).toBeGreaterThan(0);
});

test.prop([query, fc.array(hanChar, { minLength: 0, maxLength: 10 })])(
  '同長度下，逐 token 頻率都不少的文件分數不低於另一份',
  (q, filler) => {
    // A 含完整查詢；B 把 A 的查詢部分換成不相干的字（token 頻率只可能較少）
    const a = q + filler.join('');
    const b = '甲'.repeat(q.length) + filler.join('');
    const idx = buildKeywordIndex([a, b, '乙丙丁']);
    const rs = bm25Search(idx, q, 10);
    const sa = rs.find((r) => r.id === 0)?.score ?? 0;
    const sb = rs.find((r) => r.id === 1)?.score ?? 0;
    expect(sa).toBeGreaterThanOrEqual(sb);
  },
);

test.prop([docs, query])('序列化後讀回，查詢結果相同', (ds, q) => {
  const idx = buildKeywordIndex(ds);
  const back = deserializeKeywordIndex(serializeKeywordIndex(idx));
  expect(bm25Search(back, q, 50)).toEqual(bm25Search(idx, q, 50));
});

test('查詢含兩字以上的詞段時只比對 bigram：只共享單字的文件不出現（避免「的」「很」等常用字成為雜訊）', () => {
  const idx = buildKeywordIndex(['房屋的價值', '心裡焦慮不安', '很好']);
  const ids = bm25Search(idx, '房貸焦慮', 10).map((r) => r.id);
  expect(ids).toEqual([1]);
});

test('單字查詢仍以 unigram 比對', () => {
  const idx = buildKeywordIndex(['神愛世人', '世人']);
  expect(bm25Search(idx, '愛', 10).map((r) => r.id)).toEqual([0]);
});
