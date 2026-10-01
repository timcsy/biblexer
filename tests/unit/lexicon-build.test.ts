// 守護：research R9、衍生原則 9（只用可追溯的語言資料：辭典近義詞、原文同字；不遞迴、不含主題分類）
import { describe, expect, test } from 'vitest';
import { buildLexicon, moedictSynonyms, strongsGroups } from '../../scripts/lib/lexicon.ts';

const moedict = [
  { title: '焦慮', heteronyms: [{ definitions: [{ synonyms: '焦急,焦灼,著急,憂慮' }, { def: '一種緊張不安的情緒' }] }] },
  { title: '擔心', heteronyms: [{ definitions: [{ synonyms: '憂慮,掛念' }] }] },
  { title: '咖啡', heteronyms: [{ definitions: [{ def: '飲料' }] }] },
];
const unvRows = [
  { txt: '應當一無<WG3367>掛慮<WG3309>，只要' },
  { txt: '不要<WG3361>憂慮<WG3309>吃甚麼' },
  { txt: '何必用思慮<WG3309>呢；又為衣裳憂慮<WG3309>' },
  { txt: '耶穌<WG2424>說' },
];
const cuv = '應當一無掛慮，只要凡事藉著禱告。不要憂慮吃甚麼。何必用思慮呢。他心裡著急。';

describe('萌典近義詞', () => {
  test('取出 definitions 的近義詞；沒有近義詞的詞條略過', () => {
    const syn = moedictSynonyms(moedict);
    expect(syn.get('焦慮')).toEqual(['焦急', '焦灼', '著急', '憂慮']);
    expect(syn.has('咖啡')).toBe(false);
  });
});

describe('原文同字分組', () => {
  test('依 Strong\'s 編號分組；包含較短片段的長片段被去除；單字片段不收', () => {
    const g = strongsGroups(unvRows);
    expect(new Set(g.get('G3309'))).toEqual(new Set(['掛慮', '憂慮', '思慮']));
  });
});

describe('詞彙表', () => {
  const lex = buildLexicon(moedictSynonyms(moedict), strongsGroups(unvRows), cuv);

  test('辭典近義詞只保留和合本中出現的詞，並標明來源 moedict', () => {
    const terms = lex['焦慮']!;
    expect(terms).toContainEqual(['憂慮', 'moedict']);
    expect(terms).toContainEqual(['著急', 'moedict']);
    expect(terms.map(([t]) => t)).not.toContain('焦灼');
    expect(terms.map(([t]) => t)).not.toContain('焦急');
  });

  test('辭典擴充詞再以原文同字擴充一層，來源標明 Strong\'s 編號', () => {
    expect(lex['焦慮']).toContainEqual(['掛慮', 'strongs:G3309']);
    expect(lex['焦慮']).toContainEqual(['思慮', 'strongs:G3309']);
  });

  test('和合本詞本身也能以原文同字擴充', () => {
    expect(lex['憂慮']).toEqual(expect.arrayContaining([['掛慮', 'strongs:G3309'], ['思慮', 'strongs:G3309']]));
  });

  test('不遞迴：原文同字擴充出的詞，不再查它的辭典近義詞；同一擴充詞只出現一次', () => {
    const terms = lex['焦慮']!.map(([t]) => t);
    expect(new Set(terms).size).toBe(terms.length);
    expect(terms).not.toContain('焦慮');
  });

  test('沒有任何擴充的詞不收錄', () => {
    expect(lex['咖啡']).toBeUndefined();
  });
});
