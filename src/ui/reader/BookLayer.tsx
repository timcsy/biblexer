// 書卷層：全貌（著陸點＝章起點）。章號一律對齊在一條邊上，讓眼睛能沿著讀下來：
// - 章節地圖（預設）：章號就是每列最左邊的標籤（排列本身已對齊）
// - 頁面網格：章號移到每一列頁面的左側邊緣；頁面內只在章起點畫一條細橫線
import type { Layout } from '../../reader/layout.ts';
import { WORLD, gridRect, lineRect } from '../../reader/world.ts';
import { U } from './units.ts';

export function BookLayer({ layout, pages, px, current, aligned, onChapter }: { layout: Layout; pages: number[]; px: number; current?: number; aligned?: boolean; onChapter?: (chapter: number) => void }) {
  const shown = new Set(pages);
  const chip = (chapter: number) => (
    <span
      key={chapter}
      class={chapter === current ? 'bchap current' : 'bchap'}
      aria-current={chapter === current ? 'location' : undefined}
      data-testid="book-chapter"
      data-chapter={chapter}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onChapter?.(chapter);
      }}
    >
      {chapter}
    </span>
  );

  if (!aligned) {
    return (
      <>
        {layout.chapters.map((c) => {
          const r = lineRect(layout, layout.lines[c.line]!.pos);
          return (
            <div key={c.chapter} class="bchap-at" style={{ left: `${r.x * U}px`, top: `${r.y * U}px`, fontSize: `${18 * px}px` }}>
              {chip(c.chapter)}
            </div>
          );
        })}
      </>
    );
  }

  // 頁面網格：依「每一列頁面」分組，章號排在該列左側邊緣
  const per = layout.params.pagesPerRow;
  const byRow = new Map<number, number[]>();
  for (const c of layout.chapters) {
    const row = Math.floor(layout.lines[c.line]!.pos.page / per);
    (byRow.get(row) ?? byRow.set(row, []).get(row)!).push(c.chapter);
  }
  const g = gridRect(layout);
  return (
    <>
      {layout.chapters
        .filter((c) => shown.has(layout.lines[c.line]!.pos.page))
        .map((c) => {
          const r = lineRect(layout, layout.lines[c.line]!.pos);
          return <div key={`tick-${c.chapter}`} class={c.chapter === current ? 'btick current' : 'btick'} style={{ left: `${r.x * U}px`, top: `${(r.y + WORLD.lineHeight * 0.45) * U}px`, width: `${r.w * U}px`, height: `${Math.max(0.12, 2 * px / U) * U}px` }} />;
        })}
      {[...byRow.entries()].map(([row, chapters]) => (
        <div key={`row-${row}`} class="brow" style={{ right: `${-(g.x - 1.5) * U}px`, top: `${row * WORLD.pageHeight * U}px`, fontSize: `${16 * px}px` }}>
          {chapters.map(chip)}
        </div>
      ))}
    </>
  );
}
