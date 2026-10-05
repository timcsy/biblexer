// 與視窗無關的方格排版（research R1、R2；原則 1：位置就是記憶）
// 換行只由格數決定：每個字元一格，不依字型字寬。函式不接收任何視窗參數。
import type { VerseRef } from '../core/refs.ts';
import type { DisplayPart } from '../core/text.ts';

export interface LayoutParams {
  cellsPerLine: number;
  linesPerColumn: number;
  columnsPerPage: number;
  pagesPerRow: number;
  paragraphIndent: number;
}

export const DEFAULT_LAYOUT: Readonly<LayoutParams> = { cellsPerLine: 18, linesPerColumn: 16, columnsPerPage: 2, pagesPerRow: 6, paragraphIndent: 2 };

export interface BookVerse {
  ref: VerseRef;
  parts: DisplayPart[];
  merged: boolean;
  mergedTo?: number;
}

export type CellKind = 'text' | 'note' | 'verseNum' | 'chapterLabel' | 'indent';

export interface Cell {
  kind: CellKind;
  char: string;
  /** 佔幾格（一般為 1；合併節節號 2；章號標籤 4） */
  width: number;
  /** 所屬經節（相對於本書第一節的索引） */
  verseIdx: number | null;
}

export interface LinePos {
  page: number;
  column: number;
  line: number;
}

export interface CellPos extends LinePos {
  cell: number;
}

export interface Line {
  index: number;
  pos: LinePos;
  cells: Cell[];
  paragraphStart: boolean;
  chapterStart: boolean;
}

export interface VersePos {
  verseIdx: number;
  start: CellPos;
  end: CellPos;
}

export interface Layout {
  book: number;
  params: LayoutParams;
  lines: Line[];
  verses: VersePos[];
  /** 段落起點所在的行 */
  paragraphs: Array<{ verseIdx: number; line: number }>;
  /** 章號標籤所在的行 */
  chapters: Array<{ chapter: number; line: number }>;
  pageCount: number;
  /**
   * 原型：另一種世界排列中每一行的位置（依行的索引）。有值時世界座標以它為準，
   * 版面（頁、欄、行、格）不變。用於書卷層的章節地圖。
   */
  lineRects?: ReadonlyArray<{ x: number; y: number; w: number; h: number }>;
  /** 有 lineRects 時：整個排列的外框，以及每一章那一列的外框 */
  bounds?: { x: number; y: number; w: number; h: number };
  rows?: ReadonlyArray<{ chapter: number; rect: { x: number; y: number; w: number; h: number } }>;
}

const CLOSING = new Set('，。、；：？！」』）】〉》─…');
const OPENING = new Set('「『（【〈《');

/** 不可出現在行首的結尾標點 */
export const isClosingPunct = (ch: string): boolean => CLOSING.has(ch);
/** 不可出現在行尾的開頭標點 */
export const isOpeningPunct = (ch: string): boolean => OPENING.has(ch);

export const lineWidth = (line: Line): number => line.cells.reduce((s, c) => s + c.width, 0);

export function linePos(index: number, params: LayoutParams): LinePos {
  const column = Math.floor(index / params.linesPerColumn);
  return { page: Math.floor(column / params.columnsPerPage), column: column % params.columnsPerPage, line: index % params.linesPerColumn };
}

/**
 * 不可拆的組：開頭標點與節號黏在下一個字前面，結尾標點黏在前一個字後面。
 * 換行只發生在組與組之間，因此行首不會是結尾標點、行尾不會是開頭標點。
 */
function groups(cells: Cell[]): Cell[][] {
  const out: Cell[][] = [];
  let prefix: Cell[] = [];
  for (const c of cells) {
    const isText = c.kind === 'text' || c.kind === 'note';
    if (isText && isClosingPunct(c.char) && prefix.length === 0 && out.length > 0) out.at(-1)!.push(c);
    else if (c.kind === 'verseNum' || (isText && isOpeningPunct(c.char))) prefix.push(c);
    else {
      out.push([...prefix, c]);
      prefix = [];
    }
  }
  if (prefix.length) out.push(prefix);
  return out;
}

export function layoutBook(input: { book: number; verses: readonly BookVerse[]; paragraphStarts: readonly number[] }, params: LayoutParams = DEFAULT_LAYOUT): Layout {
  const { cellsPerLine } = params;
  const paraSet = new Set(input.paragraphStarts);
  const lines: Line[] = [];
  const paragraphs: Layout['paragraphs'] = [];
  const chapters: Layout['chapters'] = [];
  let cur: Cell[] | null = null;
  let flags = { paragraphStart: false, chapterStart: false };
  let width = 0;

  const close = () => {
    if (cur && cur.length) lines.push({ index: lines.length, pos: linePos(lines.length, params), cells: cur, ...flags });
    cur = null;
  };
  const open = (f: Partial<typeof flags> = {}) => {
    close();
    cur = [];
    width = 0;
    flags = { paragraphStart: false, chapterStart: false, ...f };
  };
  const place = (g: Cell[]) => {
    const w = g.reduce((s, c) => s + c.width, 0);
    const fits = width + w <= cellsPerLine || (width + w === cellsPerLine + 1 && isClosingPunct(g.at(-1)!.char));
    if (!fits && width > 0) open();
    if (!cur) open();
    // 一組比一行還寬（真實經文不會發生）：逐格放，必要時換行
    if (w > cellsPerLine + 1) {
      for (const c of g) {
        if (width + c.width > cellsPerLine) open();
        cur!.push(c);
        width += c.width;
      }
      return;
    }
    cur!.push(...g);
    width += w;
  };

  let pending: Cell[] = [];
  const flush = () => {
    for (const g of groups(pending)) place(g);
    pending = [];
  };

  let chapter = -1;
  input.verses.forEach((v, i) => {
    if (v.merged) return;
    const newChapter = v.ref.chapter !== chapter;
    const newPara = paraSet.has(i);
    if (newChapter || newPara) flush();
    if (newChapter) {
      chapter = v.ref.chapter;
      open({ chapterStart: true });
      cur!.push({ kind: 'chapterLabel', char: `第 ${chapter} 章`, width: 4, verseIdx: null });
      chapters.push({ chapter, line: lines.length });
      close();
    }
    if (newPara) {
      open({ paragraphStart: true });
      paragraphs.push({ verseIdx: i, line: lines.length });
      for (let k = 0; k < params.paragraphIndent; k++) cur!.push({ kind: 'indent', char: '', width: 1, verseIdx: null });
      width = params.paragraphIndent;
    } else if (newChapter) open();
    pending.push({ kind: 'verseNum', char: v.mergedTo ? `${v.ref.verse}–${v.mergedTo}` : String(v.ref.verse), width: v.mergedTo ? 2 : 1, verseIdx: i });
    for (const p of v.parts) for (const ch of p.value) pending.push({ kind: p.kind, char: ch, width: 1, verseIdx: i });
  });
  flush();
  close();

  // 經節座標：由排好的格反推起始格與結束格
  const found = new Map<number, VersePos>();
  for (const line of lines) {
    let x = 0;
    for (const c of line.cells) {
      if (c.verseIdx !== null) {
        const at = { ...line.pos, cell: x };
        const p = found.get(c.verseIdx);
        if (p) p.end = at;
        else found.set(c.verseIdx, { verseIdx: c.verseIdx, start: at, end: at });
      }
      x += c.width;
    }
  }
  const lastLine = lines.at(-1);
  return {
    book: input.book,
    params,
    lines,
    verses: [...found.values()].sort((a, b) => a.verseIdx - b.verseIdx),
    paragraphs,
    chapters,
    pageCount: lastLine ? lastLine.pos.page + 1 : 0,
  };
}
