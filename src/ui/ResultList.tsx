import type { Granularity } from '../core/search.ts';
import type { PresentedResponse } from '../worker/present.ts';
import type { PresentedResult } from '../worker/present.ts';
import { ExpansionNote } from './ExpansionNote.tsx';
import { FilterBar, type FilterKey } from './FilterBar.tsx';
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
  filter: FilterKey | null;
  onFilter: (k: FilterKey | null) => void;
  onExpand: (r: PresentedResult) => void;
}

export function ResultList(p: ResultListProps) {
  return (
    <section class="results" data-testid="results" data-query={p.query} data-granularity={p.response.granularity} data-filter={p.filter ?? ''} data-semantic={String(p.response.semanticReady)} aria-live="polite">
      <div class="results-head">
        <h2 data-testid="results-title">{STRINGS.resultsTitle}</h2>
        <GranularityToggle value={p.granularity} onChange={p.onGranularity} />
      </div>
      <ExpansionNote expansions={p.response.expansions} enabled={p.expand} onToggle={p.onToggleExpand} />
      <FilterBar counts={p.response.counts} value={p.filter} onChange={p.onFilter} />
      {p.results.length === 0 && p.filter && (
        <p class="empty">
          <span data-testid="filter-empty">{STRINGS.filterEmpty}</span>
          <button type="button" class="link" data-testid="filter-clear" onClick={() => p.onFilter(null)}>
            {STRINGS.filterClear}
          </button>
        </p>
      )}
      {p.results.length === 0 && !p.filter && <p class="empty">{STRINGS.noResults}</p>}
      {p.results.map((r) => (
        <PassageCard key={`${r.passage.id}`} r={r} onExpand={p.onExpand} />
      ))}
      {p.results.length < p.response.total && (
        <button type="button" class="more" data-testid="load-more" onClick={p.onLoadMore}>
          {STRINGS.loadMore}
        </button>
      )}
    </section>
  );
}
