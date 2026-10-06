// 正典的焦點樹（原型第三版；knowledge/draft/2026-10-05-混合曲率作為人機介面的基石.md）：
// 使用者回饋「一般人對於雙曲的認知應該比較像是樹狀結構而不是龐加萊圓盤」——所以用熟悉的樹（目錄、檔案總管）呈現，
// 保留雙曲的好處「焦點附近展開、遠處收攏」（Furnas 1986 廣義魚眼；Card & Nation 的關注度樹）。
// 聖經 → 約 → 類別 → 書卷 → 章：焦點那一枝完全展開；其他類別收成一行；焦點書卷的各章排成章號格。
import { BOOKS, CATEGORY_LABELS, CHAPTER_COUNTS, TESTAMENT_LABELS, type Testament } from '../core/canon.ts';

export interface TreeItem {
  id: string;
  kind: 'root' | 'testament' | 'category' | 'book' | 'chapter';
  label: string;
  parent: string | null;
  /** 欄（層級）與列（由上往下） */
  col: number;
  row: number;
  /** 在焦點路徑上 */
  current: boolean;
  /** 收攏的類別：其中的卷數；展開或不適用時為 null */
  collapsed: number | null;
  /** 收攏類別的第一卷（點它時焦點移過去）、書卷、章 */
  book: number | null;
  chapter: number | null;
}

const COL = { root: 0, testament: 1, category: 2, book: 3, chapter: 4 } as const;

/** below：窄螢幕時章號格放在書卷下方（縮排，在書卷那一欄），而不是右邊另一欄 */
export function layoutCanonTree(focusBook: number, perRow = 10, below = false): TreeItem[] {
  const focus = BOOKS[focusBook - 1]!;
  const items: TreeItem[] = [];
  let row = 0;
  const push = (it: Omit<TreeItem, 'col'>) => items.push({ ...it, col: COL[it.kind] });
  push({ id: 'root', kind: 'root', label: '聖經', parent: null, row, current: true, collapsed: null, book: null, chapter: null });
  for (const tm of ['OT', 'NT'] as Testament[]) {
    const tid = `t:${tm}`;
    push({ id: tid, kind: 'testament', label: TESTAMENT_LABELS[tm], parent: 'root', row, current: focus.testament === tm, collapsed: null, book: null, chapter: null });
    const books = BOOKS.filter((b) => b.testament === tm);
    const cats = [...new Set(books.map((b) => b.category))];
    for (const cat of cats) {
      const inCat = books.filter((b) => b.category === cat);
      const cid = `c:${tm}:${cat}`;
      const open = focus.testament === tm && focus.category === cat;
      push({ id: cid, kind: 'category', label: CATEGORY_LABELS[cat], parent: tid, row, current: open, collapsed: open ? null : inCat.length, book: inCat[0]!.id, chapter: null });
      if (!open) {
        row++;
        continue;
      }
      for (const b of inCat) {
        const bid = `b:${b.id}`;
        const isFocus = b.id === focusBook;
        push({ id: bid, kind: 'book', label: b.name, parent: cid, row, current: isFocus, collapsed: null, book: b.id, chapter: null });
        if (!isFocus) {
          row++;
          continue;
        }
        const n = CHAPTER_COUNTS[b.id - 1]!;
        const start = below ? row + 1 : row;
        for (let c = 1; c <= n; c++) {
          items.push({ id: `ch:${b.id}:${c}`, kind: 'chapter', label: String(c), parent: bid, col: below ? COL.book : COL.chapter, row: start + Math.floor((c - 1) / perRow), current: false, collapsed: null, book: b.id, chapter: c });
        }
        row = start + Math.max(below ? 0 : 1, Math.ceil(n / perRow));
      }
    }
  }
  return items;
}
