// 把核心搜尋結果加工成介面要用的資料（經文片段、出處、分類標籤）
import type { StoredVerse } from '../core/artifacts.ts';
import { CATEGORY_LABELS, TESTAMENT_LABELS, bookById } from '../core/canon.ts';
import { formatRange } from '../core/refs.ts';
import type { SearchResponse, SearchResult } from '../core/search.ts';
import { splitDisplay, type DisplayPart } from '../core/text.ts';

export interface PresentedVerse {
  ref: StoredVerse['ref'];
  parts: DisplayPart[];
  /** 是否為結果本體（否則為前後文） */
  inResult: boolean;
  /** 合併節佔位（內容併入前一節） */
  merged: boolean;
  /** 承載合併內容的節：合併到第幾節（如 29 節承載 29–30 → 30） */
  mergedTo?: number;
}

export interface PresentedResult extends SearchResult {
  label: string;
  categoryLabel: string;
  startRef: StoredVerse['ref'];
  endRef: StoredVerse['ref'];
  verses: PresentedVerse[];
}

export interface PresentedResponse extends Omit<SearchResponse, 'results'> {
  results: PresentedResult[];
  granularity: 'verse' | 'passage' | 'chapter';
}

export interface ChapterView {
  label: string;
  verses: PresentedVerse[];
  /** 段落起點（經節索引，相對於本章第一節） */
  passageStarts: number[];
}

/** 閱讀器用：一整卷的經節與段落起點（contracts/reader-api.md §2） */
export interface BookData {
  book: number;
  verses: PresentedVerse[];
  /** 段落起點（經節索引，相對於本書第一節） */
  paragraphStarts: number[];
}

/** 經文卡的一段（spec 003）：所在段落的經文，所選經節 inResult = true */
export interface CardView {
  start: [number, number, number];
  end: [number, number, number];
  label: string;
  contextLabel: string | null;
  verses: PresentedVerse[];
}

/** 串珠（spec 004）：分層；目前只有語意近鄰層 */
export interface ParallelItem {
  tier: 'quotation' | 'semantic';
  label: string;
  startRef: StoredVerse['ref'];
  endRef: StoredVerse['ref'];
  verses: PresentedVerse[];
}

export interface ParallelsView {
  semanticReady: boolean;
  /** 語意近鄰的依據（模型識別），署名用 */
  model: string | null;
  items: ParallelItem[];
}

export function presentVerses(verses: readonly StoredVerse[], from: number, to: number, inResult: (i: number) => boolean): PresentedVerse[] {
  const out: PresentedVerse[] = [];
  for (let i = from; i <= to; i++) {
    const v = verses[i]!;
    let last = i;
    while (verses[last + 1]?.merged) last++;
    out.push({
      ref: v.ref,
      parts: splitDisplay(v.display),
      inResult: inResult(i),
      merged: v.merged,
      ...(last > i && !v.merged ? { mergedTo: verses[last]!.ref.verse } : {}),
    });
  }
  return out;
}

export function presentResponse(r: SearchResponse, verses: readonly StoredVerse[], granularity: PresentedResponse['granularity']): PresentedResponse {
  return {
    ...r,
    granularity,
    results: r.results.map((x) => {
      const startRef = verses[x.passage.start]!.ref;
      const endRef = verses[x.passage.end]!.ref;
      const book = bookById(x.passage.book)!;
      return {
        ...x,
        startRef,
        endRef,
        label: formatRange(startRef, endRef),
        categoryLabel: `${TESTAMENT_LABELS[book.testament]}・${CATEGORY_LABELS[book.category]}`,
        verses: presentVerses(verses, x.contextRange.start, x.contextRange.end, (i) => i >= x.passage.start && i <= x.passage.end),
      };
    }),
  };
}
