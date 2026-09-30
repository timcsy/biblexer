// 組裝搜尋結果（contracts/search-api.md §2）
//
// 原則 5（上下文優先）：結果單位是段落，附前後文範圍。
// 原則 6（標示相關，不標示權威）：結果物件不含任何分數。
import { bm25Search, buildKeywordIndex, type KeywordIndex } from './bm25.ts';
import { bookById, type Category, type Testament } from './canon.ts';
import { aggregateToPassages, rrf } from './fusion.ts';
import { buildUnits, SEGMENTATION_ID } from './passages.ts';
import type { Ranked } from './ranked.ts';
import type { IndexRange } from './refs.ts';
import { buildVectorStore, semanticSearch, type VectorStore } from './vectors.ts';

export const CONTEXT_VERSES = 2;
export const MAX_QUERY_CHARS = 512;
export const DEFAULT_LIMIT = 10;
const CANDIDATES = 100;

export interface CorpusVerse {
  book: number;
  chapter: number;
  verse: number;
  searchText: string;
}

export interface Corpus {
  verses: CorpusVerse[];
  passages: IndexRange[];
  units: Array<IndexRange & { passageId: number }>;
  unitToPassage: Int32Array;
  keyword: KeywordIndex;
  vectors: VectorStore | null;
  chapterStart: Int32Array;
  chapterEnd: Int32Array;
}

export interface CorpusParts {
  verses: CorpusVerse[];
  passages: IndexRange[];
  units?: Array<IndexRange & { passageId: number }>;
  keyword?: KeywordIndex;
  vectors: VectorStore | readonly Float32Array[] | null;
}

export const unitText = (verses: readonly CorpusVerse[], u: IndexRange): string =>
  verses.slice(u.start, u.end + 1).map((v) => v.searchText).join('');

export function buildCorpus(parts: CorpusParts): Corpus {
  const { verses, passages } = parts;
  const units =
    parts.units ?? buildUnits(passages.map((p, id) => ({ ...p, id, segmentation: SEGMENTATION_ID }))).map(({ start, end, passageId }) => ({ start, end, passageId }));
  const keyword = parts.keyword ?? buildKeywordIndex(units.map((u) => unitText(verses, u)));
  const vectors = parts.vectors === null ? null : Array.isArray(parts.vectors) ? buildVectorStore(parts.vectors) : (parts.vectors as VectorStore);
  if (vectors && vectors.count !== units.length) throw new Error(`向量數（${vectors.count}）與檢索單元數（${units.length}）不符`);

  const chapterStart = new Int32Array(verses.length);
  const chapterEnd = new Int32Array(verses.length);
  let s = 0;
  for (let i = 0; i <= verses.length; i++) {
    const a = verses[i], prev = verses[i - 1];
    if (i === verses.length || (prev && (a!.book !== prev.book || a!.chapter !== prev.chapter))) {
      for (let k = s; k < i; k++) {
        chapterStart[k] = s;
        chapterEnd[k] = i - 1;
      }
      s = i;
    }
  }
  return { verses, passages, units, unitToPassage: Int32Array.from(units.map((u) => u.passageId)), keyword, vectors, chapterStart, chapterEnd };
}

export type Source = 'keyword' | 'semantic' | 'reference';

export interface SearchFilter {
  testaments?: Testament[];
  categories?: Array<[Testament, Category]>;
}

export interface SearchRequest {
  query: string;
  filter?: SearchFilter;
  offset?: number;
  limit?: number;
}

export interface ResultPassage extends IndexRange {
  id: number;
  book: number;
  testament: Testament;
  category: Category;
}

export interface SearchResult {
  rank: number;
  passage: ResultPassage;
  contextRange: IndexRange;
  matchedTerms: string[];
  sources: Source[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  counts: {
    testament: Partial<Record<Testament, number>>;
    category: Partial<Record<`${Testament}:${Category}`, number>>;
  };
  semanticReady: boolean;
  truncated: boolean;
  reference: IndexRange | null;
}

const HAS_TOKEN = /[\p{L}\p{N}]/u;

function passageInfo(corpus: Corpus, id: number): ResultPassage {
  const p = corpus.passages[id]!;
  const book = bookById(corpus.verses[p.start]!.book)!;
  return { id, start: p.start, end: p.end, book: book.id, testament: book.testament, category: book.category };
}

function matchesFilter(p: ResultPassage, f: SearchFilter | undefined): boolean {
  const t = f?.testaments ?? [];
  const c = f?.categories ?? [];
  if (!t.length && !c.length) return true;
  return t.includes(p.testament) || c.some(([ct, cc]) => ct === p.testament && cc === p.category);
}

export function search(req: SearchRequest, corpus: Corpus, queryVector: Float32Array | null): SearchResponse {
  const semanticReady = queryVector !== null && corpus.vectors !== null;
  const chars = [...req.query.trim()];
  const truncated = chars.length > MAX_QUERY_CHARS;
  const query = chars.slice(0, MAX_QUERY_CHARS).join('');
  const empty: SearchResponse = { results: [], total: 0, counts: { testament: {}, category: {} }, semanticReady, truncated, reference: null };
  if (!HAS_TOKEN.test(query)) return empty;

  const lists: Array<{ source: Source; ranked: Ranked[] }> = [{ source: 'keyword', ranked: bm25Search(corpus.keyword, query, CANDIDATES) }];
  if (semanticReady) lists.push({ source: 'semantic', ranked: semanticSearch(queryVector!, corpus.vectors!, CANDIDATES) });

  const sourcesByPassage = new Map<number, Set<Source>>();
  for (const { source, ranked } of lists) {
    for (const r of ranked) {
      const pid = corpus.unitToPassage[r.id]!;
      let s = sourcesByPassage.get(pid);
      if (!s) sourcesByPassage.set(pid, (s = new Set()));
      s.add(source);
    }
  }

  const ranked = aggregateToPassages(rrf(lists.map((l) => l.ranked)), corpus.unitToPassage);
  const all = ranked.map((r) => passageInfo(corpus, r.id));

  const counts: SearchResponse['counts'] = { testament: {}, category: {} };
  for (const p of all) {
    counts.testament[p.testament] = (counts.testament[p.testament] ?? 0) + 1;
    const key = `${p.testament}:${p.category}` as const;
    counts.category[key] = (counts.category[key] ?? 0) + 1;
  }

  const filtered = all.filter((p) => matchesFilter(p, req.filter));
  const offset = req.offset ?? 0;
  const limit = req.limit ?? DEFAULT_LIMIT;
  const order: Source[] = ['reference', 'keyword', 'semantic'];
  const results = filtered.slice(offset, offset + limit).map((p, i): SearchResult => ({
    rank: offset + i + 1,
    passage: p,
    contextRange: {
      start: Math.max(p.start - CONTEXT_VERSES, corpus.chapterStart[p.start]!),
      end: Math.min(p.end + CONTEXT_VERSES, corpus.chapterEnd[p.end]!),
    },
    matchedTerms: [],
    sources: order.filter((s) => sourcesByPassage.get(p.id)?.has(s)),
  }));

  return { results, total: filtered.length, counts, semanticReady, truncated, reference: null };
}
