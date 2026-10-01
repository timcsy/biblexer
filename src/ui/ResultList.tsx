import type { Granularity } from '../core/search.ts';
import type { PresentedResponse } from '../worker/present.ts';
import { ExpansionNote } from './ExpansionNote.tsx';
import { GranularityToggle } from './GranularityToggle.tsx';
import { PassageCard } from './PassageCard.tsx';
import { STRINGS } from './strings.ts';

export interface ResultListProps {
  query: string;
  response: PresentedResponse;
  results: PresentedResponse['results'];
  granularity: Granularity;
  expand: boolean;
  onGranularity: (g: Granularity) => void;
  onToggleExpand: () => void;
  onLoadMore: () => void;
}

export function ResultList(p: ResultListProps) {
  return (
    <section class="results" data-testid="results" data-query={p.query} data-granularity={p.granularity} aria-live="polite">
      <div class="results-head">
        <h2 data-testid="results-title">{STRINGS.resultsTitle}</h2>
        <GranularityToggle value={p.granularity} onChange={p.onGranularity} />
      </div>
      <ExpansionNote expansions={p.response.expansions} enabled={p.expand} onToggle={p.onToggleExpand} />
      {p.results.length === 0 && <p class="empty">{STRINGS.noResults}</p>}
      {p.results.map((r) => (
        <PassageCard key={`${r.passage.id}`} r={r} />
      ))}
      {p.results.length < p.response.total && (
        <button type="button" class="more" data-testid="load-more" onClick={p.onLoadMore}>
          {STRINGS.loadMore}
        </button>
      )}
    </section>
  );
}
