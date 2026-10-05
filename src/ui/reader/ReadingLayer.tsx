// 精讀層：方格文字（FR-001、FR-006）。每格固定寬度，不依字型字寬；只渲染視窗附近的頁。
import type { Cell, Layout, Line } from '../../reader/layout.ts';
import { WORLD, lineRect, pageRect } from '../../reader/world.ts';
import type { BookData } from '../../worker/present.ts';
import { U } from './units.ts';

export interface ReadingLayerProps {
  layout: Layout;
  data: BookData;
  pages: number[];
  linesByPage: Map<number, Line[]>;
  verseStart: Map<number, string>;
  hit: { from: number; to: number } | null;
  /** 目前停的段落所占的行（左側標示線）；畫面停在框頂端，段落以標記呈現 */
  markLines?: ReadonlySet<number>;
}

const refOf = (data: BookData, i: number) => {
  const r = data.verses[i]!.ref;
  return `${r.book}:${r.chapter}:${r.verse}`;
};

function CellView({ c }: { c: Cell }) {
  const cls = c.kind === 'text' ? 'cell' : `cell ${c.kind}`;
  return (
    <span class={cls} style={{ width: `${c.width * U}px` }}>
      {c.char}
    </span>
  );
}

function LineView({ line, layout, data, verseStart, hit }: { line: Line } & Omit<ReadingLayerProps, 'pages' | 'linesByPage'>) {
  const r = lineRect(layout, line.pos);
  // 依經節切成片段；含節號的片段承載該節的 data-pos
  const frags: Array<{ verseIdx: number | null; cells: Cell[] }> = [];
  for (const c of line.cells) {
    const last = frags.at(-1);
    if (last && last.verseIdx === c.verseIdx && c.kind !== 'verseNum') last.cells.push(c);
    else frags.push({ verseIdx: c.verseIdx, cells: [c] });
  }
  const { page, column, line: l } = line.pos;
  return (
    <div class="rline" data-testid="line" data-line={`${page}:${column}:${l}`} style={{ left: `${r.x * U}px`, top: `${r.y * U}px`, width: `${r.w * U}px`, height: `${WORLD.lineHeight * U}px` }}>
      {frags.map((f, k) => {
        if (f.verseIdx === null) return f.cells.map((c, j) => <CellView key={`${k}-${j}`} c={c} />);
        const isHit = hit !== null && f.verseIdx >= hit.from && f.verseIdx <= hit.to;
        const head = f.cells[0]!.kind === 'verseNum';
        return (
          <span key={k} class={isHit ? 'vfrag hit' : 'vfrag'} data-ref={refOf(data, f.verseIdx)} data-hit={isHit ? 'true' : 'false'} {...(head ? { 'data-testid': 'verse', 'data-pos': verseStart.get(f.verseIdx) } : {})}>
            {f.cells.map((c, j) => (
              <CellView key={j} c={c} />
            ))}
          </span>
        );
      })}
    </div>
  );
}

/** 頁面底色：讓相鄰的頁在畫面上清楚分開 */
export function PageSheets({ layout, pages }: { layout: Layout; pages: number[] }) {
  return (
    <>
      {pages.map((p) => {
        const r = pageRect(layout, p);
        return <div key={`sheet-${p}`} class="sheet" style={{ left: `${(r.x - 1) * U}px`, top: `${(r.y - 0.5) * U}px`, width: `${(r.w + 2) * U}px`, height: `${(r.h + 1) * U}px` }} />;
      })}
    </>
  );
}

export function ReadingLayer(props: ReadingLayerProps) {
  return (
    <>
      <PageSheets layout={props.layout} pages={props.pages} />
      {props.markLines &&
        props.pages.flatMap((p) =>
          (props.linesByPage.get(p) ?? [])
            .filter((l) => props.markLines!.has(l.index))
            .map((l) => {
              const r = lineRect(props.layout, l.pos);
              return <div key={`mark-${l.index}`} class="para-mark" data-testid="para-mark" data-line={`${l.pos.page}:${l.pos.column}:${l.pos.line}`} style={{ left: `${(r.x - 0.55) * U}px`, top: `${r.y * U}px`, width: `${0.2 * U}px`, height: `${WORLD.lineHeight * U}px` }} />;
            }),
        )}
      {props.pages.flatMap((p) => (props.linesByPage.get(p) ?? []).map((line) => <LineView key={line.index} line={line} layout={props.layout} data={props.data} verseStart={props.verseStart} hit={props.hit} />))}
    </>
  );
}
