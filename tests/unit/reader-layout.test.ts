// 守護：research R2 排版規則、contracts/reader-api.md §1（layoutBook）
import { describe, expect, test } from 'vitest';
import { DEFAULT_LAYOUT, isClosingPunct, isOpeningPunct, layoutBook, lineWidth, type BookVerse, type Layout } from '../../src/reader/layout.ts';

const v = (chapter: number, verse: number, text: string, extra: Partial<BookVerse> = {}): BookVerse => ({
  ref: { book: 45, chapter, verse },
  parts: text ? [{ kind: 'text', value: text }] : [],
  merged: false,
  ...extra,
});
const han = (n: number) => '甲乙丙丁戊己庚辛壬癸'.repeat(Math.ceil(n / 10)).slice(0, n);
const lineText = (layout: Layout, i: number) => layout.lines[i]!.cells.map((c) => (c.kind === 'indent' ? '_' : c.char)).join('');

describe('排版：段落、章、節號', () => {
  test('章起點先佔一行章號標籤；段落首行縮排 2 格，節號在縮排之後', () => {
    const layout = layoutBook({ book: 45, verses: [v(1, 1, '保羅'), v(1, 2, '這福音')], paragraphStarts: [0] });
    expect(layout.lines[0]!.chapterStart).toBe(true);
    expect(layout.lines[0]!.cells.map((c) => c.kind)).toEqual(['chapterLabel']);
    expect(layout.lines[0]!.cells[0]!.char).toBe('第 1 章');
    expect(layout.lines[1]!.paragraphStart).toBe(true);
    expect(lineText(layout, 1)).toBe('__1保羅2這福音');
    expect(layout.lines[1]!.cells.slice(0, 3).map((c) => c.kind)).toEqual(['indent', 'indent', 'verseNum']);
  });

  test('新段落、新章都從新的一行開始', () => {
    const layout = layoutBook({ book: 45, verses: [v(1, 1, '甲'), v(1, 2, '乙'), v(2, 1, '丙')], paragraphStarts: [0, 1] });
    expect(layout.lines.map((_, i) => lineText(layout, i))).toEqual(['第 1 章', '__1甲', '__2乙', '第 2 章', '1丙']);
    expect(layout.chapters).toEqual([
      { chapter: 1, line: 0 },
      { chapter: 2, line: 3 },
    ]);
    expect(layout.paragraphs).toEqual([
      { verseIdx: 0, line: 1 },
      { verseIdx: 1, line: 2 },
    ]);
  });

  test('節號為半形數字、佔 1 格；合併節承載節號為範圍、佔 2 格，佔位節不佔格也沒有座標', () => {
    const layout = layoutBook({ book: 45, verses: [v(1, 29, '甲', { mergedTo: 30 }), v(1, 30, '', { merged: true }), v(1, 31, '乙')], paragraphStarts: [0] });
    const nums = layout.lines.flatMap((l) => l.cells).filter((c) => c.kind === 'verseNum');
    expect(nums.map((c) => [c.char, c.width])).toEqual([
      ['29–30', 2],
      ['31', 1],
    ]);
    expect(layout.verses.map((p) => p.verseIdx)).toEqual([0, 2]);
  });

  test('和合本譯註與正文一起排，每字一格，kind 為 note', () => {
    const verse: BookVerse = { ...v(1, 1, ''), parts: [{ kind: 'text', value: '甲' }, { kind: 'note', value: '（原文是乙）' }] };
    const layout = layoutBook({ book: 45, verses: [verse], paragraphStarts: [0] });
    const cells = layout.lines[1]!.cells.filter((c) => c.kind === 'note');
    expect(cells.map((c) => c.char).join('')).toBe('（原文是乙）');
    expect(cells.every((c) => c.width === 1 && c.verseIdx === 0)).toBe(true);
  });

  test('一節跨行、跨欄、跨頁：start 為起始格，end 為結束格', () => {
    const { cellsPerLine, linesPerColumn, columnsPerPage } = DEFAULT_LAYOUT;
    // 縮排 2 + 節號 1 + 字；章標籤佔第 0 行
    const chars = cellsPerLine * linesPerColumn * columnsPerPage;
    const layout = layoutBook({ book: 45, verses: [v(1, 1, han(chars))], paragraphStarts: [0] });
    const p = layout.verses[0]!;
    expect(p.start).toEqual({ page: 0, column: 0, line: 1, cell: 2 });
    expect(p.end.page).toBe(1);
    expect(layout.pageCount).toBe(2);
  });
});

describe('排版：每行格數與禁則', () => {
  test('每行 18 格；第 19 格只允許懸掛結尾標點', () => {
    // 第 1 行：縮排 2 + 節號 1 + 15 字 = 18，句號懸掛在第 19 格
    const layout = layoutBook({ book: 45, verses: [v(1, 1, `${han(15)}。${han(3)}`)], paragraphStarts: [0] });
    expect(lineWidth(layout.lines[1]!)).toBe(19);
    expect(layout.lines[1]!.cells.at(-1)!.char).toBe('。');
    expect(lineText(layout, 2)).toBe(han(3));
  });

  test('沒有標點時第 19 個字移到下一行', () => {
    const layout = layoutBook({ book: 45, verses: [v(1, 1, han(16))], paragraphStarts: [0] });
    expect(lineWidth(layout.lines[1]!)).toBe(18);
    expect(lineText(layout, 2)).toBe(han(16).slice(15));
  });

  test('開頭標點不留在行尾：連同後一字移到下一行', () => {
    // 縮排 2 + 節號 1 + 14 字 = 17；「甲 若放在第 18、19 格會讓「留在行尾 → 整組移到下一行
    const layout = layoutBook({ book: 45, verses: [v(1, 1, `${han(14)}「甲」`)], paragraphStarts: [0] });
    expect(lineWidth(layout.lines[1]!)).toBe(17);
    expect(lineText(layout, 2)).toBe('「甲」');
  });

  test('兩個以上連續結尾標點：前一字一起移到下一行，行首仍不是標點', () => {
    // 縮排 2 + 節號 1 +「+ 13 字 = 17；「乙。」」需要 3 格，兩個結尾標點無法同時懸掛
    const layout = layoutBook({ book: 45, verses: [v(1, 1, `「${han(13)}乙。」`)], paragraphStarts: [0] });
    expect(lineWidth(layout.lines[1]!)).toBe(17);
    for (const line of layout.lines) expect(isClosingPunct(line.cells[0]!.char)).toBe(false);
    expect(lineText(layout, 2)).toBe('乙。」');
  });

  test('標點分類', () => {
    for (const c of '，。、；：？！」』）】〉') expect(isClosingPunct(c)).toBe(true);
    for (const c of '「『（【〈') expect(isOpeningPunct(c)).toBe(true);
    expect(isClosingPunct('神')).toBe(false);
    expect(isOpeningPunct('神')).toBe(false);
  });

  test('版面與視窗無關：layoutBook 不接收視窗參數，同樣輸入得到同樣結果', () => {
    const input = { book: 45, verses: [v(1, 1, han(40))], paragraphStarts: [0] };
    expect(layoutBook(input)).toEqual(layoutBook(input));
    expect(layoutBook.length).toBeLessThanOrEqual(2);
  });
});
