import { useState } from 'preact/hooks';
import { highlight } from '../core/matched.ts';
import { formatCopy } from './copy.ts';
import { STRINGS } from './strings.ts';
import type { PresentedResult, PresentedVerse } from '../worker/present.ts';

/** 本階段只有羅馬書可進入閱讀器 */
export const READER_BOOK = 45;

const refKey = (r: { book: number; chapter: number; verse: number }) => `${r.book}:${r.chapter}:${r.verse}`;

export function VerseLine({ v, terms = [] }: { v: PresentedVerse; terms?: readonly string[] }) {
  if (v.merged) return null;
  return (
    <p class={v.inResult ? 'verse' : 'verse context'}>
      <sup class="vnum">{v.mergedTo ? `${v.ref.verse}–${v.mergedTo}` : v.ref.verse}</sup>
      {v.parts.map((p, i) =>
        p.kind === 'note' ? (
          <span key={i} class="note">{p.value}</span>
        ) : (
          <span key={i}>{highlight(p.value, v.inResult ? terms : []).map((h, j) => (h.mark ? <mark key={j}>{h.text}</mark> : h.text))}</span>
        ),
      )}
    </p>
  );
}

// 原則 5：以段落與前後文呈現；原則 6：不顯示任何分數
export function PassageCard({ r, onExpand, onOpenInReader, onAddToCard, inCard }: { r: PresentedResult; onExpand?: (r: PresentedResult) => void; onOpenInReader?: (r: PresentedResult) => void; onAddToCard?: (r: PresentedResult) => void; inCard?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(formatCopy(r));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
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
          <VerseLine key={refKey(v.ref)} v={v} terms={r.matchedTerms} />
        ))}
      </div>
      <footer class="actions">
        {onExpand && (
          <button type="button" class="link" data-testid="expand-chapter" onClick={() => onExpand(r)}>
            {STRINGS.expandChapter}
          </button>
        )}
        {onOpenInReader && r.startRef.book === READER_BOOK && (
          <button type="button" class="link" data-testid="open-in-reader" onClick={() => onOpenInReader(r)}>
            {STRINGS.openInReader}
          </button>
        )}
        {onAddToCard && (
          <button type="button" class="link" data-testid="add-to-card" aria-pressed={inCard ? 'true' : 'false'} disabled={inCard} onClick={() => onAddToCard(r)}>
            {inCard ? STRINGS.inCard : STRINGS.addToCard}
          </button>
        )}
        <button type="button" class="link" data-testid="copy" onClick={() => void copy()}>
          {copied ? STRINGS.copied : STRINGS.copy}
        </button>
      </footer>
    </article>
  );
}
