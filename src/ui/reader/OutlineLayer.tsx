// 段落輪廓層：每行以長條表示（保留段落形狀），段落旁只標範圍與經文開頭字句（FR-014：不顯示標題或摘要）
import { lineWidth, type Layout, type Line } from '../../reader/layout.ts';
import { WORLD, lineRect } from '../../reader/world.ts';
import type { BookData } from '../../worker/present.ts';
import { U } from './units.ts';

const EXCERPT = 12;

/** 段落範圍，如「8:28–30」「7:25–8:4」 */
export function paragraphRange(data: BookData, from: number, to: number): string {
  const a = data.verses[from]!.ref;
  const b = data.verses[to]!.ref;
  if (from === to) return `${a.chapter}:${a.verse}`;
  return a.chapter === b.chapter ? `${a.chapter}:${a.verse}–${b.verse}` : `${a.chapter}:${a.verse}–${b.chapter}:${b.verse}`;
}

/** 段落的開頭字句：經文本身的前幾個字（不含譯註） */
export function paragraphExcerpt(data: BookData, from: number): string {
  let s = '';
  for (let i = from; i < data.verses.length && s.length < EXCERPT; i++) {
    for (const p of data.verses[i]!.parts) if (p.kind === 'text') s += p.value.replace(/\u3000/g, '');
  }
  return s.slice(0, EXCERPT) + '…';
}

export function LineBars({ layout, lines }: { layout: Layout; lines: Line[] }) {
  return (
    <>
      {lines.map((l) => {
        if (l.chapterStart) return null;
        const r = lineRect(layout, l.pos);
        const indent = l.cells.filter((c) => c.kind === 'indent').length;
        return <div key={l.index} class="obar" style={{ left: `${(r.x + indent) * U}px`, top: `${(r.y + WORLD.lineHeight * 0.3) * U}px`, width: `${(lineWidth(l) - indent) * U}px`, height: `${WORLD.lineHeight * 0.4 * U}px` }} />;
      })}
    </>
  );
}

/** 段落輪廓層的標籤（頁面底色與行長條由 Reader 共用渲染，讓排列切換時能以動畫折疊） */
export function OutlineLayer({ layout, data, pages, px, current, markLines }: { layout: Layout; data: BookData; pages: number[]; px: number; current?: number; markLines?: ReadonlySet<number> }) {
  const shown = new Set(pages);
  const paras = layout.paragraphs;
  return (
    <>
      {markLines &&
        layout.lines
          .filter((l) => markLines.has(l.index) && shown.has(l.pos.page))
          .map((l) => {
            const r = lineRect(layout, l.pos);
            return <div key={`mark-${l.index}`} class="para-mark" style={{ left: `${(r.x - 0.7) * U}px`, top: `${r.y * U}px`, width: `${0.35 * U}px`, height: `${WORLD.lineHeight * U}px` }} />;
          })}
      {layout.chapters
        // 章起點緊接段落起點時，章號併入段落標籤（避免兩個標籤重疊）
        .filter((c) => shown.has(layout.lines[c.line]!.pos.page) && !layout.lines[c.line + 1]?.paragraphStart)
        .map((c) => {
          const r = lineRect(layout, layout.lines[c.line]!.pos);
          return (
            <div key={`ch-${c.chapter}`} class="olabel ochapter" style={{ left: `${r.x * U}px`, top: `${r.y * U}px`, fontSize: `${13 * px}px` }}>
              {`第 ${c.chapter} 章`}
            </div>
          );
        })}
      {paras.map((p, i) => {
        const line = layout.lines[p.line]!;
        if (!shown.has(line.pos.page)) return null;
        const end = (paras[i + 1]?.verseIdx ?? data.verses.length) - 1;
        const range = paragraphRange(data, p.verseIdx, end);
        const label = layout.lines[p.line - 1]?.chapterStart ? layout.lines[p.line - 1]! : null;
        const r = lineRect(layout, (label ?? line).pos);
        return (
          <div key={p.verseIdx} class={p.verseIdx === current ? 'olabel current' : 'olabel'} aria-current={p.verseIdx === current ? 'location' : undefined} data-testid="outline-para" data-range={range} style={{ left: `${r.x * U}px`, top: `${r.y * U}px`, maxWidth: `${r.w * U}px`, fontSize: `${13 * px}px` }}>
            {label && <span class="ochapter">{`${label.cells[0]!.char} · `}</span>}
            <span class="orange">{range}</span> <span data-testid="outline-excerpt">{paragraphExcerpt(data, p.verseIdx)}</span>
          </div>
        );
      })}
    </>
  );
}
