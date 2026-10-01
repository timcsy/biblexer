// 守護：contracts/search-api.md §2；FR-003、FR-008、FR-016、FR-020；原則 5、6
import { describe, expect, test } from 'vitest';
import { CONTEXT_VERSES, MAX_QUERY_CHARS, buildCorpus, search } from '../../src/core/search.ts';

const verses = [
  { book: 1, chapter: 1, verse: 1, searchText: '起初神創造天地' },
  { book: 1, chapter: 1, verse: 2, searchText: '地是空虛混沌' },
  { book: 1, chapter: 1, verse: 3, searchText: '神說要有光' },
  { book: 1, chapter: 2, verse: 1, searchText: '天地萬物都造齊了' },
  { book: 43, chapter: 2, verse: 1, searchText: '第三日在加利利的迦拿有娶親的筵席' },
  { book: 43, chapter: 2, verse: 2, searchText: '耶穌和他的門徒也被請去赴席' },
  { book: 43, chapter: 2, verse: 3, searchText: '酒用盡了' },
  { book: 45, chapter: 4, verse: 3, searchText: '經上說甚麼呢亞伯拉罕信神這就算為他的義' },
];
// 段落：[0-1] [2] [3] [4-6] [7] → 每段一個檢索單元
const passages = [
  { start: 0, end: 1 },
  { start: 2, end: 2 },
  { start: 3, end: 3 },
  { start: 4, end: 6 },
  { start: 7, end: 7 },
];
const oneHot = (i: number) => Float32Array.from({ length: 5 }, (_, d) => (d === i ? 1 : 0));
// 每個檢索單元的向量＝其所屬段落的 one-hot（多尺度單元數量依段落而定）
const lexicon = { 喜宴: [['筵席', 'moedict']] } as Record<string, Array<[string, string]>>;
const corpus = buildCorpus({ verses, passages, vectors: (units) => units.map((u) => oneHot(u.passageId)), lexicon });

describe('search()', () => {
  test('結果不含任何分數欄位（原則 6）', () => {
    const r = search({ query: '神' }, corpus, null);
    expect(r.results.length).toBeGreaterThan(0);
    for (const x of r.results) {
      expect(JSON.stringify(x)).not.toMatch(/score/i);
    }
  });

  test('以段落呈現，帶約與類別；前後文為段落前後各 2 節且不跨章（原則 5）', () => {
    expect(CONTEXT_VERSES).toBe(2);
    const r = search({ query: '要有光' }, corpus, null);
    const first = r.results[0]!;
    expect(first.passage).toMatchObject({ id: 1, start: 2, end: 2, book: 1, testament: 'OT', category: 'law' });
    expect(first.contextRange).toEqual({ start: 0, end: 2 });
  });

  test('同一段落不重複；相鄰段落各自一筆，同一節不會是兩筆結果的主體', () => {
    const r = search({ query: '神' }, corpus, null);
    const ids = r.results.map((x) => x.passage.id);
    expect(new Set(ids).size).toBe(ids.length);
    const covered = r.results.flatMap((x) => Array.from({ length: x.passage.end - x.passage.start + 1 }, (_, i) => x.passage.start + i));
    expect(new Set(covered).size).toBe(covered.length);
  });

  test('counts 為篩選前的各約、各類別數量；篩選只影響 results 與 total（FR-016）', () => {
    const all = search({ query: '神' }, corpus, null);
    expect(all.counts.testament).toEqual({ OT: 2, NT: 1 });
    expect(all.counts.category).toEqual({ 'OT:law': 2, 'NT:epistles': 1 });
    const nt = search({ query: '神', filter: { testaments: ['NT'] } }, corpus, null);
    expect(nt.results.map((x) => x.passage.testament)).toEqual(['NT']);
    expect(nt.total).toBe(1);
    expect(nt.counts).toEqual(all.counts);
    const gospels = search({ query: '迦拿', filter: { categories: [['NT', 'gospels']] } }, corpus, null);
    expect(gospels.results.map((x) => x.passage.id)).toEqual([3]);
  });

  test('預設 10 筆，offset 可取後續（FR-003）', () => {
    const many = buildCorpus({
      verses: Array.from({ length: 15 }, (_, i) => ({ book: 1, chapter: i + 1, verse: 1, searchText: '愛' })),
      passages: Array.from({ length: 15 }, (_, i) => ({ start: i, end: i })),
      vectors: null,
    });
    const first = search({ query: '愛' }, many, null);
    expect(first.results).toHaveLength(10);
    expect(first.total).toBe(15);
    const rest = search({ query: '愛', offset: 10 }, many, null);
    expect(rest.results).toHaveLength(5);
    expect(rest.results[0]!.rank).toBe(11);
  });

  test('語意未就緒時只用關鍵字，semanticReady=false（FR-020）', () => {
    const r = search({ query: '迦拿' }, corpus, null);
    expect(r.semanticReady).toBe(false);
    expect(r.results[0]!.sources).toEqual(['keyword']);
    expect(search({ query: '迦拿' }, corpus, oneHot(3)).semanticReady).toBe(true);
  });

  test('關鍵字完全不存在時，仍回傳語意結果', () => {
    const r = search({ query: '完全不存在的字詞' }, corpus, oneHot(3));
    expect(r.results[0]!.passage.id).toBe(3);
    expect(r.results[0]!.sources).toContain('semantic');
  });

  test('查詢超過長度上限時截斷並標示', () => {
    expect(MAX_QUERY_CHARS).toBe(512);
    expect(search({ query: '神'.repeat(600) }, corpus, null).truncated).toBe(true);
    expect(search({ query: '神' }, corpus, null).truncated).toBe(false);
  });

  test('空白或只有標點的查詢不搜尋', () => {
    for (const q of ['', '   ', '，。！？']) {
      const r = search({ query: q }, corpus, oneHot(0));
      expect(r.results).toEqual([]);
      expect(r.total).toBe(0);
    }
  });

  test('granularity：verse／passage／chapter 的結果範圍分別為單節／段落／整章，皆附上下文（FR-026）', () => {
    const v = search({ query: '要有光', granularity: 'verse' }, corpus, null).results[0]!;
    expect([v.passage.start, v.passage.end]).toEqual([2, 2]);
    expect(v.contextRange).toEqual({ start: 0, end: 2 });
    const p = search({ query: '要有光', granularity: 'passage' }, corpus, null).results[0]!;
    expect([p.passage.start, p.passage.end]).toEqual([2, 2]);
    const c = search({ query: '要有光', granularity: 'chapter' }, corpus, null).results[0]!;
    expect([c.passage.start, c.passage.end]).toEqual([0, 2]);
    expect(c.contextRange).toEqual({ start: 0, end: 2 });
  });

  test('詞彙擴充：列出實際套用的擴充與來源；擴充命中的結果 sources 含 expansion；可關閉（FR-027）', () => {
    const r = search({ query: '喜宴' }, corpus, null);
    expect(r.expansions).toEqual([{ word: '喜宴', terms: [{ term: '筵席', via: 'moedict' }] }]);
    expect(r.results[0]!.passage.id).toBe(3);
    expect(r.results[0]!.sources).toContain('expansion');
    const off = search({ query: '喜宴', expand: false }, corpus, null);
    expect(off.expansions).toEqual([]);
    expect(off.results).toEqual([]);
  });

  test('關鍵字同時比對單節與視窗：查詢詞分散在相鄰兩節時，該段落排在只含其中一詞的單節之前', () => {
    const c = buildCorpus({
      verses: [
        { book: 43, chapter: 2, verse: 1, searchText: '第三日在加利利的迦拿' },
        { book: 43, chapter: 2, verse: 2, searchText: '有娶親的筵席耶穌的母親在那裡' },
        { book: 43, chapter: 21, verse: 2, searchText: '迦拿人' },
      ],
      passages: [{ start: 0, end: 1 }, { start: 2, end: 2 }],
      vectors: null,
    });
    expect(search({ query: '迦拿筵席' }, c, null).results[0]!.passage.id).toBe(0);
  });

  test('融合分數相同時，有字面證據（關鍵字）的段落排在只有語意命中的段落之前', () => {
    // 120 段，各一節；前 119 段向量相同（語意清單前 100 名都是它們），第 119 段含「迦拿」但向量正交（不在語意前 100 名）
    const n = 120;
    const big = buildCorpus({
      verses: Array.from({ length: n }, (_, i) => ({ book: 1, chapter: i + 1, verse: 1, searchText: i === n - 1 ? '加利利的迦拿' : '起初神創造天地' })),
      passages: Array.from({ length: n }, (_, i) => ({ start: i, end: i })),
      vectors: (units) => units.map((u) => Float32Array.from([u.passageId === n - 1 ? 0 : 1, u.passageId === n - 1 ? 1 : 0])),
    });
    const r = search({ query: '迦拿' }, big, Float32Array.from([1, 0]));
    expect(r.results[0]!.passage.id).toBe(n - 1);
    expect(r.results[0]!.sources).toEqual(['keyword']);
  });
});

