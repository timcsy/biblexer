import type { PresentedResult, PresentedVerse } from '../worker/present.ts';

const refKey = (r: { book: number; chapter: number; verse: number }) => `${r.book}:${r.chapter}:${r.verse}`;

export function VerseLine({ v }: { v: PresentedVerse }) {
  if (v.merged) return null;
  return (
    <p class={v.inResult ? 'verse' : 'verse context'}>
      <sup class="vnum">{v.ref.verse}</sup>
      {v.parts.map((p, i) => (p.kind === 'note' ? <span key={i} class="note">{p.value}</span> : <span key={i}>{p.value}</span>))}
    </p>
  );
}

// 原則 5：以段落與前後文呈現；原則 6：不顯示任何分數
export function PassageCard({ r }: { r: PresentedResult }) {
  return (
    <article
      class="result"
      data-testid="result"
      data-start={refKey(r.startRef)}
      data-end={refKey(r.endRef)}
      data-testament={r.passage.testament}
      data-category={r.passage.category}
    >
      <header>
        <h3 data-testid="result-label">{r.label}</h3>
        <span class="category" data-testid="result-category">{r.categoryLabel}</span>
      </header>
      <div class="text">
        {r.verses.map((v) => (
          <VerseLine key={refKey(v.ref)} v={v} />
        ))}
      </div>
    </article>
  );
}
