// 守護：FR-007（只含 66 卷）、FR-015（兩層分類）、原則 8（西敏：66 卷正典；舊新約分層）
import { describe, expect, test } from 'vitest';
import { BOOKS, bookByCode, bookById, bookByUsfm } from '../../src/core/canon.ts';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('正典', () => {
  test('恰好 66 卷，id 依正典順序 1..66', () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS.map((b) => b.id)).toEqual(range(1, 66));
  });

  test('創～瑪為舊約，太～啟為新約', () => {
    for (const b of BOOKS) expect(b.testament).toBe(b.id <= 39 ? 'OT' : 'NT');
  });

  test.each([
    ['律法書 創～申', 1, 5, 'OT', 'law'],
    ['舊約歷史書 書～斯', 6, 17, 'OT', 'history'],
    ['詩歌智慧書 伯～歌', 18, 22, 'OT', 'wisdom'],
    ['先知書 賽～瑪（含哀）', 23, 39, 'OT', 'prophets'],
    ['福音書 太～約', 40, 43, 'NT', 'gospels'],
    ['新約歷史書 徒', 44, 44, 'NT', 'history'],
    ['書信 羅～猶', 45, 65, 'NT', 'epistles'],
    ['啟示 啟', 66, 66, 'NT', 'revelation'],
  ] as const)('%s', (_label, from, to, testament, category) => {
    for (const id of range(from, to)) {
      const b = bookById(id);
      expect(b?.testament).toBe(testament);
      expect(b?.category).toBe(category);
    }
  });

  test('耶利米哀歌屬先知書，使徒行傳屬新約歷史書', () => {
    expect(bookByCode('Lam')?.category).toBe('prophets');
    expect(bookByCode('Acts')).toMatchObject({ testament: 'NT', category: 'history' });
  });

  test('信望愛代碼、USFM 代碼、中文簡稱與全名都能對應', () => {
    expect(bookByCode('1 Sam')).toMatchObject({ id: 9, short: '撒上', name: '撒母耳記上', usfm: '1SA' });
    expect(bookByUsfm('JHN')).toMatchObject({ id: 43, code: 'John', short: '約', name: '約翰福音' });
    expect(bookByUsfm('PHP')?.code).toBe('Phil');
    expect(new Set(BOOKS.map((b) => b.code)).size).toBe(66);
    expect(new Set(BOOKS.map((b) => b.usfm)).size).toBe(66);
    expect(new Set(BOOKS.map((b) => b.short)).size).toBe(66);
  });
});
