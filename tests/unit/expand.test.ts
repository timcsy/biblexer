// 守護：FR-027（擴充透明、可關閉、只用詞彙表）
import { describe, expect, test } from 'vitest';
import { expandQuery } from '../../src/core/expand.ts';

const lexicon = {
  焦慮: [['憂慮', 'moedict'], ['掛慮', 'strongs:G3309']],
  壓力: [['重擔', 'moedict']],
  房屋: [['房子', 'moedict']],
} as Record<string, Array<[string, string]>>;

describe('查詢擴充', () => {
  test('以最長匹配找出詞表中的詞，列出擴充詞與來源', () => {
    expect(expandQuery('面對房貸壓力很焦慮', lexicon)).toEqual([
      { word: '壓力', terms: [{ term: '重擔', via: 'moedict' }] },
      { word: '焦慮', terms: [{ term: '憂慮', via: 'moedict' }, { term: '掛慮', via: 'strongs:G3309' }] },
    ]);
  });

  test('擴充詞已在查詢中出現時不重複列出', () => {
    expect(expandQuery('焦慮又憂慮', lexicon)).toEqual([{ word: '焦慮', terms: [{ term: '掛慮', via: 'strongs:G3309' }] }]);
  });

  test('沒有可擴充的詞時回傳空陣列', () => {
    expect(expandQuery('迦拿的婚宴', lexicon)).toEqual([]);
  });
});
