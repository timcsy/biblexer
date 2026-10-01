// 守護：FR-004（經文出處查詢列為第一筆）
import { describe, expect, test } from 'vitest';
import { BOOKS } from '../../src/core/canon.ts';
import { parseReference, resolveReference } from '../../src/core/refs.ts';
import { buildCorpus, search } from '../../src/core/search.ts';

describe('解析出處文字', () => {
  test.each([
    ['羅 8:28', { book: 45, chapter: 8, from: 28, to: 28 }],
    ['羅馬書8章28節', { book: 45, chapter: 8, from: 28, to: 28 }],
    ['羅8:28-30', { book: 45, chapter: 8, from: 28, to: 30 }],
    ['羅 8：28–30', { book: 45, chapter: 8, from: 28, to: 30 }],
    ['約一 1:9', { book: 62, chapter: 1, from: 9, to: 9 }],
    ['約翰一書1章9節', { book: 62, chapter: 1, from: 9, to: 9 }],
    ['約 3:16', { book: 43, chapter: 3, from: 16, to: 16 }],
    ['詩篇 23', { book: 19, chapter: 23, from: null, to: null }],
    ['撒上17章', { book: 9, chapter: 17, from: null, to: null }],
  ])('%s', (text, expected) => {
    expect(parseReference(text)).toEqual(expected);
  });

  test('66 卷的全名與簡稱都能解析', () => {
    for (const b of BOOKS) {
      expect(parseReference(`${b.name} 1:1`)?.book).toBe(b.id);
      expect(parseReference(`${b.short} 1:1`)?.book).toBe(b.id);
    }
  });

  test('一般句子不是出處', () => {
    expect(parseReference('面對房貸壓力很焦慮')).toBeNull();
    expect(parseReference('迦拿的婚宴')).toBeNull();
  });
});

const verses = [
  { book: 45, chapter: 8, verse: 27, searchText: '鑒察人心的' },
  { book: 45, chapter: 8, verse: 28, searchText: '萬事都互相效力' },
  { book: 45, chapter: 8, verse: 29, searchText: '預先所知道的人' },
  { book: 45, chapter: 9, verse: 1, searchText: '我在基督裡說真話' },
];

describe('對照經文', () => {
  test('存在的章節回傳經節索引範圍；不存在回傳 null', () => {
    expect(resolveReference({ book: 45, chapter: 8, from: 28, to: 28 }, verses)).toEqual({ start: 1, end: 1 });
    expect(resolveReference({ book: 45, chapter: 8, from: null, to: null }, verses)).toEqual({ start: 0, end: 2 });
    expect(resolveReference({ book: 45, chapter: 8, from: 40, to: 40 }, verses)).toBeNull();
    expect(resolveReference({ book: 45, chapter: 30, from: null, to: null }, verses)).toBeNull();
  });

  test('出處查詢時，該段落為第 1 筆，且 sources 含 reference', () => {
    const c = buildCorpus({ verses, passages: [{ start: 0, end: 0 }, { start: 1, end: 2 }, { start: 3, end: 3 }], vectors: null });
    const r = search({ query: '羅 8:28' }, c, null);
    expect(r.reference).toEqual({ start: 1, end: 1 });
    expect(r.results[0]!.passage.id).toBe(1);
    expect(r.results[0]!.sources).toContain('reference');
  });
});
