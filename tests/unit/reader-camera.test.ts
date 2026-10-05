// 守護：research R4（層級、著陸點、吸附、focus）、contracts/reader-api.md §1（camera.ts）
import { describe, expect, test } from 'vitest';
import { cameraForVerse, createContext, landingPoints, levelOf, panBy, placeAt, refit, snap, snapToward, step, zoomAt, zoomStep, LEVEL_SCALE } from '../../src/reader/camera.ts';
import { layoutBook, type BookVerse } from '../../src/reader/layout.ts';
import { WORLD, lineRect } from '../../src/reader/world.ts';
import { sampleBook } from './reader-fixture.ts';

const sample = sampleBook();
const layout = layoutBook(sample);
const phone = createContext(layout, { width: 390, height: 744 });
const desktop = createContext(layout, { width: 1440, height: 800 });

describe('層級', () => {
  test('依精讀比例 r：≥ 0.6r 精讀、0.25r～0.6r 段落輪廓、0.06r～0.25r 書卷、< 0.06r 正典', () => {
    const r = 20;
    expect(levelOf(r, r)).toBe('reading');
    expect(levelOf(0.6 * r, r)).toBe('reading');
    expect(levelOf(0.59 * r, r)).toBe('outline');
    expect(levelOf(0.25 * r, r)).toBe('outline');
    expect(levelOf(0.24 * r, r)).toBe('book');
    expect(levelOf(0.06 * r, r)).toBe('book');
    expect(levelOf(0.05 * r, r)).toBe('canon');
    for (const l of ['canon', 'book', 'outline', 'reading'] as const) expect(levelOf(LEVEL_SCALE[l] * r, r)).toBe(l);
  });

  test('精讀比例：手機一欄填滿寬度、桌機一頁填滿；一整欄 16 行都放得進視窗高度', () => {
    expect(phone.mode).toBe('column');
    expect(desktop.mode).toBe('page');
    for (const ctx of [phone, desktop]) {
      expect(ctx.readingScale * WORLD.lineHeight * 16).toBeLessThanOrEqual(ctx.viewport.height);
      expect(ctx.readingScale * (ctx.mode === 'page' ? 2 * WORLD.columnWidth + WORLD.columnGap : WORLD.columnWidth)).toBeLessThanOrEqual(ctx.viewport.width);
    }
  });
});

describe('著陸點集合', () => {
  test('正典＝66 卷；書卷＝各章起點；段落輪廓＝段落起點；精讀＝段落起點 ∪ 欄頂端', () => {
    expect(landingPoints(layout, 'canon').map((p) => p.id)).toEqual(Array.from({ length: 66 }, (_, i) => `book:${i + 1}`));
    expect(landingPoints(layout, 'book').map((p) => p.id)).toEqual(layout.chapters.map((c) => `chapter:45:${c.chapter}`));
    expect(landingPoints(layout, 'outline').map((p) => p.id)).toEqual(layout.paragraphs.map((p) => `para:${p.verseIdx}`));
    const reading = landingPoints(layout, 'reading');
    // 段落緊接章號標籤時，著陸點在標籤行（讓章號留在畫面上）
    const landLine = (line: number) => (layout.lines[line - 1]?.chapterStart ? line - 1 : line);
    const paraLines = new Set(layout.paragraphs.map((p) => landLine(p.line)));
    for (const p of layout.paragraphs) expect(reading.find((x) => x.id === `para:${p.verseIdx}`)!.line).toBe(landLine(p.line));
    const colTops = layout.lines.filter((l) => l.pos.line === 0 && !paraLines.has(l.index));
    expect(reading.map((p) => p.id).sort()).toEqual([...layout.paragraphs.map((p) => `para:${p.verseIdx}`), ...colTops.map((l) => `coltop:${l.pos.page}:${l.pos.column}`)].sort());
    // 依閱讀順序
    const lines = reading.map((p) => p.line!);
    expect(lines).toEqual([...lines].sort((a, b) => a - b));
  });
});

describe('吸附與定位', () => {
  test('精讀層吸附後頂端對齊行的上緣；比例為 r', () => {
    for (const ctx of [phone, desktop]) {
      for (const lp of landingPoints(layout, 'reading')) {
        const c = placeAt(lp, ctx);
        expect(c.scale).toBe(ctx.readingScale);
        expect(c.y).toBeCloseTo(lineRect(layout, layout.lines[lp.line!]!.pos).y, 9);
        expect(c).toMatchObject({ at: lp.id, focus: lp.id });
      }
    }
  });

  test('cameraForVerse：落在該節所在段落起點的精讀著陸點', () => {
    // 找一個至少兩節的段落，取它的第二節
    const k = layout.paragraphs.findIndex((p, i) => (layout.paragraphs[i + 1]?.verseIdx ?? Infinity) > p.verseIdx + 1);
    const para = layout.paragraphs[k]!;
    const inside = para.verseIdx + 1;
    const c = cameraForVerse(inside, phone);
    expect(c).toMatchObject({ at: `para:${para.verseIdx}`, focus: `para:${para.verseIdx}`, scale: phone.readingScale });
  });

  test('已在著陸點上時，吸附不改變位置', () => {
    const lp = landingPoints(layout, 'reading')[3]!;
    const c = placeAt(lp, desktop);
    expect(snap(c, desktop)).toEqual(c);
  });

  test('縮小按鈕依序經過 精讀 → 段落輪廓 → 書卷 → 正典，到邊界後不再變化', () => {
    let c = cameraForVerse(10, phone);
    const levels = [levelOf(c.scale, phone.readingScale)];
    for (let i = 0; i < 4; i++) {
      c = zoomStep(c, phone, -1);
      levels.push(levelOf(c.scale, phone.readingScale));
    }
    expect(levels).toEqual(['reading', 'outline', 'book', 'canon', 'canon']);
    // 放大回來回到原處
    for (let i = 0; i < 4; i++) c = zoomStep(c, phone, 1);
    expect(c).toEqual(cameraForVerse(10, phone));
  });
});

describe('縮放按鈕沿結構上下移動', () => {
  test('放大：章 → 含該章第一節的段落 → 同一段落的精讀著陸點', () => {
    const ch = layout.chapters[3]!;
    const book = landingPoints(layout, 'book').find((p) => p.id === `chapter:45:${ch.chapter}`)!;
    const outline = zoomStep(placeAt(book, phone), phone, 1);
    const firstVerse = book.verseIdx!;
    const para = layout.paragraphs.filter((p) => p.verseIdx <= firstVerse).at(-1)!;
    expect(outline.at).toBe(`para:${para.verseIdx}`);
    expect(zoomStep(outline, phone, 1).at).toBe(`para:${para.verseIdx}`);
  });

  test('縮小：段落 → 所在的章 → 本書', () => {
    const para = layout.paragraphs.find((p) => p.verseIdx > 60)!;
    let c = cameraForVerse(para.verseIdx, phone);
    c = zoomStep(c, phone, -1);
    expect(c.at).toBe(`para:${para.verseIdx}`);
    c = zoomStep(c, phone, -1);
    const chapter = layout.chapters.filter((x) => x.line <= para.line).at(-1)!;
    expect(c.at).toBe(`chapter:45:${chapter.chapter}`);
    c = zoomStep(c, phone, -1);
    expect(c.at).toBe('book:45');
  });

  test('在書卷層用方向鍵換章是移動：清除 focus，放大後落在新的那一章', () => {
    let c = zoomStep(zoomStep(cameraForVerse(0, phone), phone, -1), phone, -1);
    expect(c.focus).toBeDefined();
    c = step(c, phone, 1, 'landing');
    expect(c.at).toBe('chapter:45:2');
    expect(c.focus).toBeUndefined();
    c = zoomStep(zoomStep(c, phone, 1), phone, 1);
    const firstOfCh2 = sample.verses.findIndex((v) => v.ref.chapter === 2);
    expect(c.at).toBe(`para:${layout.paragraphs.filter((p) => p.verseIdx <= firstOfCh2).at(-1)!.verseIdx}`);
  });
});

describe('平移放手：沿移動方向前進', () => {
  // 起點：與下一個著陸點至少相距 8 行，前一個也至少 8 行（讓「最近的仍是原點」成立）
  const pts = landingPoints(layout, 'reading');
  const k = pts.findIndex((p, i) => i > 0 && pts[i + 1]!.line! - p.line! >= 8 && p.line! - pts[i - 1]!.line! >= 8);
  const start = placeAt(pts[k]!, phone);

  test('移動很小：吸附回原本的著陸點', () => {
    expect(snapToward(panBy(start, 0, -10, phone), start, phone)).toEqual(start);
  });

  test('往下捲動超過門檻、但最近的仍是原點：前進到下一個著陸點', () => {
    const moved = panBy(start, 0, -80, phone);
    expect(snap(moved, phone).at).toBe(start.at);
    expect(snapToward(moved, start, phone)).toEqual(step(start, phone, 1, 'landing'));
  });

  test('往上捲動：回到上一個著陸點', () => {
    expect(snapToward(panBy(start, 0, 80, phone), start, phone)).toEqual(step(start, phone, -1, 'landing'));
  });

  test('水平移動：到下一框（手機為下一欄）', () => {
    expect(snapToward(panBy(start, -80, 0, phone), start, phone)).toEqual(step(start, phone, 1, 'frame'));
  });

  test('移動夠遠、最近的已是別的著陸點：照一般吸附', () => {
    const far = panBy(start, 0, -2000, phone);
    expect(snapToward(far, start, phone)).toEqual(snap(far, phone));
  });

  test('層級改變（縮放）：照一般吸附', () => {
    const z = zoomAt(start, 0.4, { x: 100, y: 100 }, phone);
    expect(snapToward(z, start, phone)).toEqual(snap(z, phone));
  });
});

describe('鍵盤導覽與視窗改變', () => {
  test('翻「框」：手機為下一欄頂端，桌機為下一頁頂端', () => {
    const first = placeAt(landingPoints(layout, 'reading')[0]!, phone);
    const nextCol = step(first, phone, 1, 'frame');
    expect(layout.lines[landingPoints(layout, 'reading').find((p) => p.id === nextCol.at)!.line!]!.pos).toMatchObject({ page: 0, column: 1, line: 0 });
    const firstD = placeAt(landingPoints(layout, 'reading')[0]!, desktop);
    const nextPage = step(firstD, desktop, 1, 'frame');
    expect(layout.lines[landingPoints(layout, 'reading').find((p) => p.id === nextPage.at)!.line!]!.pos).toMatchObject({ page: 1, column: 0, line: 0 });
    // 第一框往前：停在原處
    expect(step(first, phone, -1, 'frame')).toEqual(first);
  });

  test('視窗大小改變：版面不動，相機重新對準原本的著陸點並保留 focus', () => {
    const c = cameraForVerse(20, desktop);
    const moved = refit(c, desktop, phone);
    expect(moved).toMatchObject({ at: c.at, focus: c.focus, scale: phone.readingScale });
    expect(moved).toEqual(placeAt(landingPoints(layout, 'reading').find((p) => p.id === c.at)!, phone));
  });
});

// 讓型別檢查器確認 BookVerse 仍是 layout 的輸入型別
export type _Check = BookVerse;
