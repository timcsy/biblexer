// 守護：data-model Verse 的驗證規則；research R1（譯註只抽出譯者註，經文本身的括號內容保留）
import { describe, expect, test } from 'vitest';
import { splitDisplay, toSearchText } from '../../src/core/text.ts';

describe('譯註抽出', () => {
  test('（原文是…）（或譯…）（或作…）（有古卷…）是譯註', () => {
    const d = '耶穌的母親（原文是婦人）在那裡，或（或譯：這樣）（或作：那樣）（有古卷加：某句）';
    const parts = splitDisplay(d);
    expect(parts.filter((p) => p.kind === 'note').map((p) => p.value)).toEqual([
      '（原文是婦人）',
      '（或譯：這樣）',
      '（或作：那樣）',
      '（有古卷加：某句）',
    ]);
    expect(parts.map((p) => p.value).join('')).toBe(d);
  });

  test('【…】一律是譯註', () => {
    const parts = splitDisplay('直等細羅【就是賜平安者】來到');
    expect(parts).toEqual([
      { kind: 'text', value: '直等細羅' },
      { kind: 'note', value: '【就是賜平安者】' },
      { kind: 'text', value: '來到' },
    ]);
  });

  test('經文本身的括號內容（詩篇標題、細拉、旁白）不是譯註', () => {
    for (const d of ['（大衛上行之詩。）耶和華啊', '我必不怕。（細拉）', '（其實不是耶穌親自施洗，乃是他的門徒施洗，）', '〈以法他就是伯利恆〉']) {
      expect(splitDisplay(d).every((p) => p.kind === 'text')).toBe(true);
    }
  });

  test('未閉合的「（有古卷加：」到句尾是譯註（徒 8:36 型）', () => {
    const d = '我受洗有甚麼妨礙呢？」（有古卷加：';
    expect(splitDisplay(d).at(-1)).toEqual({ kind: 'note', value: '（有古卷加：' });
  });

  test('殘缺括號容錯：「（倘或.」與「﹞）」不會丟出例外', () => {
    expect(() => splitDisplay('這石頭就可以向你們作見證（倘或.')).not.toThrow();
    expect(() => splitDisplay('﹞）你們不要效法')).not.toThrow();
  });
});

describe('檢索文字', () => {
  test('移除譯註、「　神」的抬頭空白、連接號；統一人名間隔點', () => {
    expect(toSearchText('起初，　神創造天地。')).toBe('起初，神創造天地。');
    expect(toSearchText('耶和華─你們的　神')).toBe('耶和華你們的神');
    expect(toSearchText('基列•亞巴與基列．亞巴')).toBe('基列‧亞巴與基列‧亞巴');
    expect(toSearchText('耶穌的母親（原文是婦人）在那裡')).toBe('耶穌的母親在那裡');
  });

  test('經文本身的括號內容保留文字、去掉括號', () => {
    expect(toSearchText('（大衛上行之詩。）耶和華啊')).toBe('大衛上行之詩。耶和華啊');
    expect(toSearchText('〈以法他就是伯利恆〉')).toBe('以法他就是伯利恆');
  });

  test('驗證規則：檢索文字不含（【〈', () => {
    const s = toSearchText('甲（原文是乙）丙【丁】戊〈己〉（庚');
    expect(s).not.toMatch(/[（【〈]/);
  });
});
