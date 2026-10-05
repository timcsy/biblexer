// 守護：spec 003 FR-006（上下文優先：部分經節展開為整個段落並標示所選經節）
import { describe, expect, test } from 'vitest';
import type { StoredVerse } from '../../src/core/artifacts.ts';
import { resolveItem } from '../../src/core/card.ts';

const v = (c: number, n: number): StoredVerse => ({ ref: { book: 45, chapter: c, verse: n }, display: `${c}:${n}`, notes: [], merged: false, variant: false });
// 7:24、7:25 ｜ 8:1–4 一段（跨章：7:25–8:4）｜ 8:28–30 一段
const verses = [v(7, 24), v(7, 25), v(8, 1), v(8, 2), v(8, 3), v(8, 4), v(8, 28), v(8, 29), v(8, 30)];
const passages = [
  { start: 0, end: 0 },
  { start: 1, end: 5 },
  { start: 6, end: 8 },
];

describe('段落解析', () => {
  test('單節：展開為所在段落，標示所選經節；出處同時標明所選範圍與段落範圍', () => {
    const r = resolveItem({ start: [45, 8, 28], end: [45, 8, 28] }, verses, passages)!;
    expect(r).toEqual({ label: '羅馬書 8:28', contextLabel: '8:28–30', from: 6, to: 8, selFrom: 6, selTo: 6 });
  });

  test('跨章的段落：段落範圍標明起訖章節', () => {
    const r = resolveItem({ start: [45, 8, 2], end: [45, 8, 3] }, verses, passages)!;
    expect(r).toMatchObject({ label: '羅馬書 8:2–3', contextLabel: '7:25–8:4', from: 1, to: 5, selFrom: 3, selTo: 4 });
  });

  test('所選範圍就是整個段落：不重複標段落範圍', () => {
    const r = resolveItem({ start: [45, 8, 28], end: [45, 8, 30] }, verses, passages)!;
    expect(r.contextLabel).toBeNull();
  });

  test('跨多個段落：取涵蓋起訖節的連續段落', () => {
    const r = resolveItem({ start: [45, 8, 4], end: [45, 8, 29] }, verses, passages)!;
    expect(r).toMatchObject({ from: 1, to: 8, selFrom: 5, selTo: 7 });
  });

  test('合併節：選到承載節時一併包含佔位節', () => {
    const merged = [v(1, 28), { ...v(1, 29) }, { ...v(1, 30), merged: true, display: '' }, v(1, 31)];
    const r = resolveItem({ start: [45, 1, 29], end: [45, 1, 29] }, merged, [{ start: 0, end: 3 }])!;
    expect(r).toMatchObject({ label: '羅馬書 1:29–30', selFrom: 1, selTo: 2, contextLabel: '1:28–31' });
  });

  test('找不到的經節：回傳 null', () => {
    expect(resolveItem({ start: [45, 9, 1], end: [45, 9, 1] }, verses, passages)).toBeNull();
  });
});
