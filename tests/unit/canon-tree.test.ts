// 守護：src/reader/canonTree.ts——正典的焦點樹（原型第三版）：熟悉的樹形，焦點那一枝展開、遠處收攏
import { describe, expect, test } from 'vitest';
import { BOOKS, CHAPTER_COUNTS } from '../../src/core/canon.ts';
import { layoutCanonTree, type TreeItem } from '../../src/reader/canonTree.ts';

const ofKind = (items: TreeItem[], k: TreeItem['kind']) => items.filter((i) => i.kind === k);

describe('焦點樹的排版', () => {
  const items = layoutCanonTree(45, 10);

  test('聖經 → 舊約、新約 → 八個類別，全部都看得到（地標）', () => {
    expect(ofKind(items, 'root').length).toBe(1);
    expect(ofKind(items, 'testament').map((t) => t.label)).toEqual(['舊約', '新約']);
    expect(ofKind(items, 'category').length).toBe(8);
  });

  test('只有焦點書卷所在的類別展開書卷；其他類別收成一行並標出卷數', () => {
    const books = ofKind(items, 'book');
    const epistles = BOOKS.filter((b) => b.category === BOOKS[44]!.category).map((b) => b.id);
    expect(books.map((b) => b.book)).toEqual(epistles);
    const law = ofKind(items, 'category').find((c) => c.label.startsWith('律法書'))!;
    expect(law.collapsed).toBe(5);
    expect(ofKind(items, 'category').filter((c) => c.collapsed === null).length).toBe(1);
  });

  test('焦點書卷展開各章；焦點路徑標記為 current', () => {
    expect(ofKind(items, 'chapter').map((c) => c.chapter)).toEqual(Array.from({ length: CHAPTER_COUNTS[44]! }, (_, i) => i + 1));
    expect(items.filter((i) => i.current).map((i) => i.kind)).toEqual(['root', 'testament', 'category', 'book']);
  });

  test('排版：欄依層級往右；同一欄的節點不重疊；子節點在父節點之後', () => {
    const col = { root: 0, testament: 1, category: 2, book: 3, chapter: 4 } as const;
    for (const i of items) expect(i.col).toBe(col[i.kind] + (i.kind === 'chapter' ? 0 : 0));
    const seen = new Set<string>();
    for (const i of items) {
      const key = `${i.col}:${i.row}:${i.kind === 'chapter' ? i.chapter! % 10 : ''}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      if (i.parent !== null) expect(i.row).toBeGreaterThanOrEqual(items.find((p) => p.id === i.parent)!.row);
    }
  });

  test('章號每列最多 perRow 個', () => {
    const rows = new Map<number, number>();
    for (const c of ofKind(items, 'chapter')) rows.set(c.row, (rows.get(c.row) ?? 0) + 1);
    for (const n of rows.values()) expect(n).toBeLessThanOrEqual(10);
    expect(rows.size).toBe(Math.ceil(16 / 10));
  });

  test('窄螢幕：章號格放在書卷下方（縮排），後面的書卷往下移', () => {
    const items = layoutCanonTree(45, 5, true);
    const rom = items.find((i) => i.kind === 'book' && i.book === 45)!;
    const chs = items.filter((i) => i.kind === 'chapter');
    expect(Math.min(...chs.map((c) => c.row))).toBe(rom.row + 1);
    const next = items.find((i) => i.kind === 'book' && i.book === 46)!;
    // 章號格之後空一列，與下一卷分開
    expect(next.row).toBe(rom.row + 1 + Math.ceil(16 / 5) + 1);
    expect(chs.every((c) => c.col === 3)).toBe(true);
  });

  test('換焦點到創世記：律法書展開、書信收攏', () => {
    const g = layoutCanonTree(1, 10);
    expect(ofKind(g, 'book').map((b) => b.book)).toEqual([1, 2, 3, 4, 5]);
    expect(ofKind(g, 'chapter').length).toBe(50);
  });
});

describe('第五版：份量、配色、正典帶', () => {
  test('收起的類別帶著卷數與章數（份量條用）；律法書 5 卷 187 章', () => {
    const law = layoutCanonTree(45, 10).find((i) => i.id === 'c:OT:law')!;
    expect([law.collapsed, law.chapters]).toEqual([5, 187]);
  });

  test('配色鍵＝約＋類別（舊約、新約都有歷史書，要分開）；書卷沿用所屬類別的鍵', () => {
    const items = layoutCanonTree(45, 10);
    const keys = items.filter((i) => i.kind === 'category').map((i) => i.palette);
    expect(new Set(keys).size).toBe(8);
    expect(items.find((i) => i.kind === 'book' && i.book === 45)!.palette).toBe('NT:epistles');
  });

  test('正典帶：66 段依章數比例、依正典順序、首尾相接且總長為 1', async () => {
    const { canonStrip } = await import('../../src/reader/canonTree.ts');
    const segs = canonStrip();
    expect(segs.map((s) => s.book)).toEqual(Array.from({ length: 66 }, (_, i) => i + 1));
    expect(segs[0]!.x0).toBe(0);
    expect(segs.at(-1)!.x1).toBeCloseTo(1, 12);
    for (let i = 1; i < 66; i++) expect(segs[i]!.x0).toBeCloseTo(segs[i - 1]!.x1, 12);
    expect((segs[18]!.x1 - segs[18]!.x0) / (segs[30]!.x1 - segs[30]!.x0)).toBeCloseTo(150, 6);
  });
});
