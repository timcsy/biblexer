// 段落輪廓與書卷層的記號（spec 006 FR-003）：在該節的行旁邊畫色條。
// 寬度依縮放換算——螢幕上至少約 6 像素，拉遠時不跟著縮到看不見（像紙本快速翻過時一眼認得出的記號）。
import type { Layout } from '../../reader/layout.ts';
import { lineIndexOf, lineRect } from '../../reader/world.ts';
import { U } from './units.ts';

export function MarkBars({ layout, marked, px }: { layout: Layout; marked: ReadonlySet<number>; px: number }) {
  const w = Math.max(0.5 * U, 6 * px);
  const bars: Array<{ key: string; x: number; y: number; h: number }> = [];
  for (const vp of layout.verses) {
    if (!marked.has(vp.verseIdx)) continue;
    const a = lineIndexOf(layout, vp.start);
    const b = lineIndexOf(layout, vp.end);
    // 依欄（同一欄裡連續的行）各畫一段
    let run: { x: number; y: number; bottom: number } | null = null;
    for (let i = a; i <= b; i++) {
      const r = lineRect(layout, layout.lines[i]!.pos);
      if (run && Math.abs(r.x - run.x) < 1e-6 && r.y >= run.bottom - 1e-6 && r.y - run.bottom < r.h) run.bottom = r.y + r.h;
      else {
        if (run) bars.push({ key: `${vp.verseIdx}-${bars.length}`, x: run.x, y: run.y, h: run.bottom - run.y });
        run = { x: r.x, y: r.y, bottom: r.y + r.h };
      }
    }
    if (run) bars.push({ key: `${vp.verseIdx}-${bars.length}`, x: run.x, y: run.y, h: run.bottom - run.y });
  }
  return (
    <>
      {bars.map((b) => (
        <div key={b.key} class="mark-bar" data-testid="mark-bar" style={{ left: `${b.x * U - w - 0.2 * U}px`, top: `${b.y * U}px`, width: `${w}px`, height: `${b.h * U}px` }} />
      ))}
    </>
  );
}
