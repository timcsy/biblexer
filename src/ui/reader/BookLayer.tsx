// 書卷層：頁面縮圖＋章號（著陸點＝章起點）
import type { Layout, Line } from '../../reader/layout.ts';
import { lineRect } from '../../reader/world.ts';
import { LineBars } from './OutlineLayer.tsx';
import { PageSheets } from './ReadingLayer.tsx';
import { U } from './units.ts';

export function BookLayer({ layout, pages, linesByPage, px }: { layout: Layout; pages: number[]; linesByPage: Map<number, Line[]>; px: number }) {
  const shown = new Set(pages);
  return (
    <>
      <PageSheets layout={layout} pages={pages} />
      <LineBars layout={layout} lines={pages.flatMap((p) => linesByPage.get(p) ?? [])} />
      {layout.chapters
        .filter((c) => shown.has(layout.lines[c.line]!.pos.page))
        .map((c) => {
          const r = lineRect(layout, layout.lines[c.line]!.pos);
          return (
            <div key={c.chapter} class="bchap" data-testid="book-chapter" data-chapter={c.chapter} style={{ left: `${r.x * U}px`, top: `${r.y * U}px`, fontSize: `${18 * px}px` }}>
              {c.chapter}
            </div>
          );
        })}
    </>
  );
}
