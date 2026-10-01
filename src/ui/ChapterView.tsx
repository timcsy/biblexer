import { useEffect, useRef } from 'preact/hooks';
import type { ChapterView as ChapterData } from '../worker/present.ts';
import { STRINGS } from './strings.ts';

// FR-010：展開全章並定位到命中段落；段落之間以空行分隔（只用分段邊界，不顯示標題）
export function ChapterView({ data, hit, onClose }: { data: ChapterData; hit: { from: number; to: number }; onClose: () => void }) {
  const firstHit = useRef<HTMLParagraphElement>(null);
  useEffect(() => firstHit.current?.scrollIntoView({ block: 'center' }), [data]);
  const starts = new Set(data.passageStarts);
  return (
    <section class="chapter" data-testid="chapter-view">
      <header class="chapter-head">
        <h2 data-testid="chapter-title">{data.label}</h2>
        <button type="button" data-testid="chapter-close" onClick={onClose}>
          {STRINGS.closeChapter}
        </button>
      </header>
      {data.verses.map((v, i) => {
        if (v.merged) return null;
        const isHit = v.ref.verse >= hit.from && v.ref.verse <= hit.to;
        return (
          <p
            key={v.ref.verse}
            ref={isHit && !data.verses.slice(0, i).some((x) => x.ref.verse >= hit.from && x.ref.verse <= hit.to) ? firstHit : null}
            class={`verse${starts.has(i) && i > 0 ? ' para' : ''}${isHit ? ' hit' : ''}`}
            data-hit={isHit ? 'true' : 'false'}
          >
            <sup class="vnum">{v.mergedTo ? `${v.ref.verse}–${v.mergedTo}` : v.ref.verse}</sup>
            {v.parts.map((p, j) => (p.kind === 'note' ? <span key={j} class="note">{p.value}</span> : <span key={j}>{p.value}</span>))}
          </p>
        );
      })}
    </section>
  );
}
