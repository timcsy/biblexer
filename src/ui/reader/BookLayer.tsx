// 書卷層：頁面縮圖＋章號（著陸點＝章起點）
import type { Layout } from '../../reader/layout.ts';
import { lineRect } from '../../reader/world.ts';
import { U } from './units.ts';

/** 書卷層的章號（頁面縮圖由 Reader 共用渲染） */
export function BookLayer({ layout, pages, px, current }: { layout: Layout; pages: number[]; px: number; current?: number }) {
  const shown = new Set(pages);
  return (
    <>
      {layout.chapters
        .filter((c) => shown.has(layout.lines[c.line]!.pos.page))
        .map((c) => {
          const r = lineRect(layout, layout.lines[c.line]!.pos);
          return (
            <div key={c.chapter} class={c.chapter === current ? 'bchap current' : 'bchap'} aria-current={c.chapter === current ? 'location' : undefined} data-testid="book-chapter" data-chapter={c.chapter} style={{ left: `${r.x * U}px`, top: `${r.y * U}px`, fontSize: `${18 * px}px` }}>
              {c.chapter}
            </div>
          );
        })}
    </>
  );
}
