// 組裝搜尋結果（contracts/search-api.md §2）
//
// 原則 5（上下文優先）：結果單位是段落，附前後文範圍。
// 原則 6（標示相關，不標示權威）：結果物件不含任何分數。
import { bm25Search, buildKeywordIndex, type KeywordIndex } from './bm25.ts';
import { bookById, type Category, type Testament } from './canon.ts';
import { aggregateToPassages, rrf } from './fusion.ts';
import { expandQuery, type Expansion, type Lexicon } from './expand.ts';
import { buildUnits, SEGMENTATION_ID, type UnitScale } from './passages.ts';
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

export type CorpusUnit = IndexRange & { passageId: number; scale: UnitScale };

export interface Corpus {
  verses: CorpusVerse[];
  passages: IndexRange[];
  /** 多尺度檢索單元；單節單元排在最前面（id 0..V-1） */
  units: CorpusUnit[];
  unitToPassage: Int32Array;
  /** 建立在單節單元上，文件 id 即單元 id */
  keyword: KeywordIndex;
  vectors: VectorStore | null;
  lexicon: Lexicon | null;
  chapterStart: Int32Array;
  chapterEnd: Int32Array;
  /** 每節所屬章的序號，以及每章的範圍 */
  chapterOf: Int32Array;
  chapters: IndexRange[];
}

export interface CorpusParts {
  verses: CorpusVerse[];
  passages: IndexRange[];
  units?: CorpusUnit[];
  keyword?: KeywordIndex;
  vectors: VectorStore | readonly Float32Array[] | ((units: readonly CorpusUnit[]) => Float32Array[]) | null;
  lexicon?: Lexicon | null;
  /** 不建立單節單元的經節（合併節佔位） */
  skipVerse?: (verseIdx: number) => boolean;
}

export const unitText = (verses: readonly CorpusVerse[], u: IndexRange): string =>
  verses.slice(u.start, u.end + 1).map((v) => v.searchText).join('');

export function buildCorpus(parts: CorpusParts): Corpus {
  const { verses, passages } = parts;
  const units: CorpusUnit[] =
    parts.units ??
    buildUnits(
      passages.map((p, id) => ({ ...p, id, segmentation: SEGMENTATION_ID })),
      parts.skipVerse ? { skipVerse: parts.skipVerse } : {},
    ).map(({ start, end, passageId, scale }) => ({ start, end, passageId, scale }));
  const verseUnits = units.filter((u) => u.scale === 'verse');
  if (units.slice(0, verseUnits.length).some((u) => u.scale !== 'verse')) throw new Error('單節單元必須排在最前面');
  const keyword = parts.keyword ?? buildKeywordIndex(verseUnits.map((u) => unitText(verses, u)));
  const v = parts.vectors;
  const vectors =
    v === null ? null : typeof v === 'function' ? buildVectorStore(v(units)) : Array.isArray(v) ? buildVectorStore(v) : (v as VectorStore);
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
  const chapterOf = new Int32Array(verses.length);
  const chapters: IndexRange[] = [];
  for (let i = 0; i < verses.length; i++) {
    if (i === 0 || chapterStart[i] !== chapterStart[i - 1]) chapters.push({ start: chapterStart[i]!, end: chapterEnd[i]! });
    chapterOf[i] = chapters.length - 1;
  }
  return {
    verses,
    passages,
    units,
    unitToPassage: Int32Array.from(units.map((u) => u.passageId)),
    keyword,
    vectors,
    lexicon: parts.lexicon ?? null,
    chapterStart,
    chapterEnd,
    chapterOf,
    chapters,
  };
}

export type Source = 'keyword' | 'semantic' | 'expansion' | 'reference';
export type Granularity = 'verse' | 'passage' | 'chapter';

export interface SearchFilter {
  testaments?: Testament[];
  categories?: Array<[Testament, Category]>;
}

export interface SearchRequest {
  query: string;
  /** 呈現粒度，預設 passage（FR-026） */
  granularity?: Granularity;
  /** 詞彙擴充，預設 true（FR-027） */
  expand?: boolean;
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
  /** 實際套用的詞彙擴充與來源（FR-027），供介面列出與署名 */
  expansions: Expansion[];
}

const HAS_TOKEN = /[\p{L}\p{N}]/u;

function itemRange(corpus: Corpus, g: Granularity, id: number): IndexRange {
  if (g === 'verse') return { start: id, end: id };
  if (g === 'chapter') return corpus.chapters[id]!;
  return corpus.passages[id]!;
}

function itemInfo(corpus: Corpus, g: Granularity, id: number): ResultPassage {
  const r = itemRange(corpus, g, id);
  const book = bookById(corpus.verses[r.start]!.book)!;
  return { id, start: r.start, end: r.end, book: book.id, testament: book.testament, category: book.category };
}

/** 檢索單元 → 呈現單位（-1 表示此粒度不採用該單元） */
function unitTarget(corpus: Corpus, g: Granularity, unitId: number): number {
  const u = corpus.units[unitId]!;
  if (g === 'verse') return u.scale === 'verse' ? u.start : -1;
  if (g === 'chapter') return corpus.chapterOf[u.start]!;
  return u.passageId;
}

function matchesFilter(p: ResultPassage, f: SearchFilter | undefined): boolean {
  const t = f?.testaments ?? [];
  const c = f?.categories ?? [];
  if (!t.length && !c.length) return true;
  return t.includes(p.testament) || c.some(([ct, cc]) => ct === p.testament && cc === p.category);
}

export function search(req: SearchRequest, corpus: Corpus, queryVector: Float32Array | null): SearchResponse {
  const semanticReady = queryVector !== null && corpus.vectors !== null;
  const granularity = req.granularity ?? 'passage';
  const chars = [...req.query.trim()];
  const truncated = chars.length > MAX_QUERY_CHARS;
  const query = chars.slice(0, MAX_QUERY_CHARS).join('');
  const empty: SearchResponse = { results: [], total: 0, counts: { testament: {}, category: {} }, semanticReady, truncated, reference: null, expansions: [] };
  if (!HAS_TOKEN.test(query)) return empty;

  const expansions = req.expand !== false && corpus.lexicon ? expandQuery(query, corpus.lexicon) : [];
  const lists: Array<{ source: Source; ranked: Ranked[] }> = [{ source: 'keyword', ranked: bm25Search(corpus.keyword, query, CANDIDATES) }];
  if (expansions.length) {
    const terms = expansions.flatMap((e) => e.terms.map((t) => t.term)).join(' ');
    lists.push({ source: 'expansion', ranked: bm25Search(corpus.keyword, terms, CANDIDATES) });
  }
  if (semanticReady) lists.push({ source: 'semantic', ranked: semanticSearch(queryVector!, corpus.vectors!, CANDIDATES) });

  const target = Int32Array.from(corpus.units, (_, i) => unitTarget(corpus, granularity, i));
  const sourcesByItem = new Map<number, Set<Source>>();
  for (const { source, ranked } of lists) {
    for (const r of ranked) {
      const t = target[r.id]!;
      if (t < 0) continue;
      let set = sourcesByItem.get(t);
      if (!set) sourcesByItem.set(t, (set = new Set()));
      set.add(source);
    }
  }

  const fused = rrf(lists.map((l) => l.ranked)).filter((r) => target[r.id]! >= 0);
  const all = aggregateToPassages(fused, target).map((r) => itemInfo(corpus, granularity, r.id));

  const counts: SearchResponse['counts'] = { testament: {}, category: {} };
  for (const p of all) {
    counts.testament[p.testament] = (counts.testament[p.testament] ?? 0) + 1;
    const key = `${p.testament}:${p.category}` as const;
    counts.category[key] = (counts.category[key] ?? 0) + 1;
  }

  const filtered = all.filter((p) => matchesFilter(p, req.filter));
  const offset = req.offset ?? 0;
  const limit = req.limit ?? DEFAULT_LIMIT;
  const order: Source[] = ['reference', 'keyword', 'expansion', 'semantic'];
  const results = filtered.slice(offset, offset + limit).map((p, i): SearchResult => ({
    rank: offset + i + 1,
    passage: p,
    contextRange:
      granularity === 'chapter'
        ? { start: p.start, end: p.end }
        : {
            start: Math.max(p.start - CONTEXT_VERSES, corpus.chapterStart[p.start]!),
            end: Math.min(p.end + CONTEXT_VERSES, corpus.chapterEnd[p.end]!),
          },
    matchedTerms: [],
    sources: order.filter((src) => sourcesByItem.get(p.id)?.has(src)),
  }));

  return { results, total: filtered.length, counts, semanticReady, truncated, reference: null, expansions };
}
