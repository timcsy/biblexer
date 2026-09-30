import { describe, expect, test } from 'vitest';
import { compareRefs, formatRange, overlaps, parseRefString } from '../../src/core/refs.ts';

describe('經節參照', () => {
  test('依正典順序比較', () => {
    expect(compareRefs({ book: 1, chapter: 1, verse: 2 }, { book: 1, chapter: 2, verse: 1 })).toBeLessThan(0);
    expect(compareRefs({ book: 2, chapter: 1, verse: 1 }, { book: 1, chapter: 50, verse: 26 })).toBeGreaterThan(0);
    expect(compareRefs({ book: 43, chapter: 2, verse: 1 }, { book: 43, chapter: 2, verse: 1 })).toBe(0);
  });

  test('以信望愛代碼解析「代碼 章:節」', () => {
    expect(parseRefString('Phil 4:6')).toEqual({ book: 50, chapter: 4, verse: 6 });
    expect(parseRefString('1 Sam 17:1')).toEqual({ book: 9, chapter: 17, verse: 1 });
    expect(parseRefString('Nope 1:1')).toBeNull();
  });

  test('區間重疊', () => {
    expect(overlaps({ start: 10, end: 20 }, { start: 20, end: 30 })).toBe(true);
    expect(overlaps({ start: 10, end: 19 }, { start: 20, end: 30 })).toBe(false);
  });

  test('格式化出處（同章、跨節）', () => {
    expect(formatRange({ book: 43, chapter: 2, verse: 1 }, { book: 43, chapter: 2, verse: 11 })).toBe('約翰福音 2:1–11');
    expect(formatRange({ book: 50, chapter: 4, verse: 6 }, { book: 50, chapter: 4, verse: 6 })).toBe('腓立比書 4:6');
  });
});
