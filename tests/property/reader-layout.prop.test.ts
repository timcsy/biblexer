// 守護：data-model「排版」性質（原則 1：位置就是記憶）
import { fc, test } from '@fast-check/vitest';
import { expect } from 'vitest';
import { isClosingPunct, isOpeningPunct, layoutBook, lineWidth, type BookVerse } from '../../src/reader/layout.ts';

// 一個詞＝（開頭標點）＋字＋（0～2 個結尾標點）；真實經文中連續標點不超過 3 個
const word = fc
  .tuple(fc.constantFrom('', '', '', '「', '『', '（'), fc.constantFrom('神', '人', '愛', '　', '.'), fc.constantFrom('', '', '', '，', '。', '」', '：', '。」', '？』'))
  .map(([o, b, c]) => o + b + c);
const text = fc.array(word, { minLength: 1, maxLength: 60 }).map((ws) => ws.join(''));
const verseSpec = fc.record({
  text,
  note: fc.option(fc.constantFrom('（原文是愛）', '【神】', '（或譯：人）'), { nil: undefined }),
  merged: fc.boolean(),
  newChapter: fc.boolean(),
  paragraph: fc.boolean(),
});

const book = fc.array(verseSpec, { minLength: 1, maxLength: 60 }).map((specs) => {
  const verses: BookVerse[] = [];
  const paragraphStarts: number[] = [];
  let chapter = 1;
  let verse = 0;
  specs.forEach((s, i) => {
    // 第一節不可為佔位節；佔位節不換章
    const merged = i > 0 && s.merged && !verses[i - 1]!.merged;
    if (i > 0 && s.newChapter && !merged) {
      chapter++;
      verse = 0;
    }
    verse++;
    if (merged) {
      const host = verses.findLast((x) => !x.merged)!;
      host.mergedTo = verse;
    }
    verses.push({
      ref: { book: 45, chapter, verse },
      parts: merged ? [] : [{ kind: 'text', value: s.text }, ...(s.note ? [{ kind: 'note' as const, value: s.note }] : [])],
      merged,
    });
    if ((i === 0 || s.paragraph) && !merged) paragraphStarts.push(i);
  });
  return { book: 45, verses, paragraphStarts };
});

const key = (p: { page: number; column: number; line: number; cell: number }) => [p.page, p.column, p.line, p.cell];
const less = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!;
  return false;
};

test.prop([book])('每行 ≤ 18 格；懸掛行 ≤ 19 格且第 19 格必為結尾標點', (input) => {
  for (const line of layoutBook(input).lines) {
    const w = lineWidth(line);
    expect(w).toBeLessThanOrEqual(19);
    if (w === 19) expect(isClosingPunct(line.cells.at(-1)!.char)).toBe(true);
  }
});

test.prop([book])('行首不為結尾標點；行尾不為開頭標點（除非該行只有此一字）', (input) => {
  for (const line of layoutBook(input).lines) {
    expect(isClosingPunct(line.cells[0]!.char)).toBe(false);
    if (line.cells.length > 1) expect(isOpeningPunct(line.cells.at(-1)!.char)).toBe(false);
  }
});

test.prop([book])('每個段落起點、章起點都在行首', (input) => {
  const layout = layoutBook(input);
  for (const { verseIdx, line } of layout.paragraphs) {
    const cells = layout.lines[line]!.cells;
    expect(cells.slice(0, 2).map((c) => c.kind)).toEqual(['indent', 'indent']);
    expect(cells[2]).toMatchObject({ kind: 'verseNum', verseIdx });
  }
  expect(layout.paragraphs.map((p) => p.verseIdx)).toEqual(input.paragraphStarts);
  for (const { line } of layout.chapters) {
    expect(layout.lines[line]!.cells.map((c) => c.kind)).toEqual(['chapterLabel']);
    expect(layout.lines[line + 1]!.cells.find((c) => c.kind !== 'indent')!.kind).toBe('verseNum');
  }
});

test.prop([book])('每一個非佔位經節恰有一個 VersePos；start 依經節順序嚴格遞增', (input) => {
  const layout = layoutBook(input);
  expect(layout.verses.map((p) => p.verseIdx)).toEqual(input.verses.flatMap((x, i) => (x.merged ? [] : [i])));
  for (let i = 1; i < layout.verses.length; i++) expect(less(key(layout.verses[i - 1]!.start), key(layout.verses[i]!.start))).toBe(true);
  for (const p of layout.verses) expect(less(key(p.end), key(p.start))).toBe(false);
});

test.prop([book])('經文與譯註的每一個字都排進版面，順序不變', (input) => {
  const layout = layoutBook(input);
  const laid = layout.lines.flatMap((l) => l.cells).filter((c) => c.kind === 'text' || c.kind === 'note').map((c) => c.char).join('');
  expect(laid).toBe(input.verses.flatMap((x) => x.parts.map((p) => p.value)).join(''));
});
