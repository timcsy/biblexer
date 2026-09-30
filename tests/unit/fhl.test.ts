// 守護：research R1（信望愛 unv 資料特性）
import { describe, expect, test } from 'vitest';
import { VARIANT_VERSES, parseUnvRows, stripStrongs } from '../../scripts/lib/fhl.ts';

describe('Strong\'s 標記移除', () => {
  test('移除 <W…> 與 {<W…>} 群組，以及殘留的單獨大括號', () => {
    expect(stripStrongs('<WG2532>第三<WG5154>日<WG2250>，{<WG2532>}酒<WG3631>')).toBe('第三日，酒');
    expect(stripStrongs('}耶穌在船尾上')).toBe('耶穌在船尾上');
    expect(stripStrongs('搖著頭，說}：')).toBe('搖著頭，說：');
  });
});

describe('解析 unv 列', () => {
  const rows = [
    { engs: 'Gen', chap: 24, sec: 29, txt: '利百加<WH07259>有一個哥哥' },
    { engs: 'Gen', chap: 24, sec: 30, txt: 'a' },
    { engs: 'Matt', chap: 18, sec: 10, txt: '你們要小心' },
    { engs: 'Matt', chap: 18, sec: 11, txt: '人子來，為要拯救失喪的人。）' },
  ];

  test('"a" 佔位列 mergedInto 同章前一節，display 為空', () => {
    const vs = parseUnvRows(rows);
    const v30 = vs.find((v) => v.ref.chapter === 24 && v.ref.verse === 30);
    expect(v30?.mergedInto).toEqual({ book: 1, chapter: 24, verse: 29 });
    expect(v30?.display).toBe('');
  });

  test('11 節異文經節被標記', () => {
    expect(VARIANT_VERSES).toHaveLength(11);
    const vs = parseUnvRows(rows);
    expect(vs.find((v) => v.ref.book === 40 && v.ref.verse === 11)?.variant).toBe(true);
    expect(vs.find((v) => v.ref.book === 40 && v.ref.verse === 10)?.variant).toBe(false);
  });

  test('"a" 若不是承接同章前一節則拋出錯誤', () => {
    expect(() => parseUnvRows([{ engs: 'Gen', chap: 1, sec: 1, txt: 'a' }])).toThrow();
  });

  test('未知書卷代碼拋出錯誤', () => {
    expect(() => parseUnvRows([{ engs: 'Xyz', chap: 1, sec: 1, txt: '甲' }])).toThrow();
  });
});
