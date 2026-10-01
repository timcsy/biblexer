// 守護：FR-015、FR-016（兩層篩選；counts 為篩選前）
import { describe, expect, test } from 'vitest';
import { buildCorpus, search } from '../../src/core/search.ts';

// 書 12（列王紀下，舊約歷史書）與書 44（使徒行傳，新約歷史書）、書 45（羅馬書，書信）
const corpus = buildCorpus({
  verses: [
    { book: 12, chapter: 2, verse: 11, searchText: '以利亞乘旋風升天去了' },
    { book: 44, chapter: 1, verse: 9, searchText: '他們正看的時候，他就被取上升' },
    { book: 45, chapter: 8, verse: 34, searchText: '基督已經死了，而且從死裡復活，現今在神的右邊' },
  ],
  passages: [{ start: 0, end: 0 }, { start: 1, end: 1 }, { start: 2, end: 2 }],
  vectors: null,
});

describe('兩層篩選', () => {
  test('舊約歷史書與新約歷史書可以分開選取', () => {
    const ot = search({ query: '升', filter: { categories: [['OT', 'history']] } }, corpus, null);
    expect(ot.results.map((r) => r.passage.book)).toEqual([12]);
    const nt = search({ query: '升', filter: { categories: [['NT', 'history']] } }, corpus, null);
    expect(nt.results.map((r) => r.passage.book)).toEqual([44]);
  });

  test('選整個約＝選該約所有類別', () => {
    const whole = search({ query: '升', filter: { testaments: ['NT'] } }, corpus, null).results.map((r) => r.passage.id);
    const cats = search({ query: '升', filter: { categories: [['NT', 'history'], ['NT', 'epistles'], ['NT', 'gospels'], ['NT', 'revelation']] } }, corpus, null).results.map((r) => r.passage.id);
    expect(whole).toEqual(cats);
  });

  test('counts 為篩選前的數量，不受篩選影響', () => {
    const all = search({ query: '升' }, corpus, null);
    const f = search({ query: '升', filter: { testaments: ['OT'] } }, corpus, null);
    expect(f.counts).toEqual(all.counts);
    expect(all.counts.category).toMatchObject({ 'OT:history': 1, 'NT:history': 1 });
  });

  test('所選分類沒有結果時 total 為 0', () => {
    expect(search({ query: '升', filter: { categories: [['OT', 'law']] } }, corpus, null).total).toBe(0);
  });
});
