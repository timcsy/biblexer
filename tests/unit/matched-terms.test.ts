// 守護：FR-006（標示與查詢相同的字詞）
import { describe, expect, test } from 'vitest';
import { findMatchedTerms, highlight } from '../../src/core/matched.ts';

describe('命中字詞', () => {
  test('只列出查詢中實際出現在段落的字詞（取最長、至少兩字）', () => {
    expect(findMatchedTerms('迦拿的婚宴', '在加利利的迦拿有娶親的筵席')).toEqual(['迦拿']);
    expect(findMatchedTerms('應當一無掛慮', '應當一無掛慮，只要凡事藉著禱告')).toEqual(['應當一無掛慮']);
    expect(findMatchedTerms('房貸焦慮', '起初神創造天地')).toEqual([]);
  });

  test('擴充詞若出現在段落中也列入', () => {
    expect(findMatchedTerms('焦慮', '應當一無掛慮', ['掛慮', '憂慮'])).toEqual(['掛慮']);
  });

  test('標示切段：片段串起來等於原文，命中處標為 mark', () => {
    const parts = highlight('應當一無掛慮，只要凡事藉著禱告', ['掛慮', '禱告']);
    expect(parts.map((p) => p.text).join('')).toBe('應當一無掛慮，只要凡事藉著禱告');
    expect(parts.filter((p) => p.mark).map((p) => p.text)).toEqual(['掛慮', '禱告']);
  });

  test('不會切斷字元（含輔助平面字）', () => {
    const s = '𠀀神𠀀';
    const parts = highlight(s, ['神']);
    expect(parts.map((p) => p.text)).toEqual(['𠀀', '神', '𠀀']);
  });
});
