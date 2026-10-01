// 守護：contracts/data-artifacts.md 的檔案格式
import { describe, expect, test } from 'vitest';
import { decodePassages, decodeUnits, decodeVerses, encodePassages, encodeUnits, encodeVerses, VERSE_FLAG_MERGED, VERSE_FLAG_VARIANT } from '../../src/core/artifacts.ts';

describe('資料產物讀寫', () => {
  test('verses.json：[bookId, chapter, verse, display, notes, flags]', () => {
    const vs = [
      { ref: { book: 1, chapter: 24, verse: 29 }, display: '利百加有一個哥哥', notes: [], merged: false, variant: false },
      { ref: { book: 1, chapter: 24, verse: 30 }, display: '', notes: [], merged: true, variant: false },
      { ref: { book: 40, chapter: 18, verse: 11 }, display: '人子來', notes: ['（有古卷加：）'], merged: false, variant: true },
    ];
    const json = encodeVerses(vs);
    expect(JSON.parse(json)[1]).toEqual([1, 24, 30, '', [], VERSE_FLAG_MERGED]);
    expect(JSON.parse(json)[2][5]).toBe(VERSE_FLAG_VARIANT);
    expect(decodeVerses(json)).toEqual(vs);
  });

  test('passages.bin：Int32 小端序 [start, end]', () => {
    const ps = [{ start: 0, end: 4 }, { start: 5, end: 5 }];
    const buf = encodePassages(ps);
    expect(buf.byteLength).toBe(16);
    expect(new DataView(buf.buffer, buf.byteOffset).getInt32(4, true)).toBe(4);
    expect(decodePassages(buf)).toEqual(ps);
  });

  test('units.bin：Int32 小端序 [start, end, passageId, scale]（0＝單節、1＝視窗、2＝整段）', () => {
    const us = [
      { start: 0, end: 0, passageId: 0, scale: 'verse' as const },
      { start: 0, end: 2, passageId: 0, scale: 'window' as const },
      { start: 0, end: 4, passageId: 0, scale: 'passage' as const },
    ];
    const buf = encodeUnits(us);
    expect(buf.byteLength).toBe(48);
    expect(new DataView(buf.buffer, buf.byteOffset).getInt32(28, true)).toBe(1);
    expect(decodeUnits(buf)).toEqual(us);
  });
});
