import { CATEGORY_LABELS, TESTAMENT_LABELS, type Category, type Testament } from '../core/canon.ts';
import type { SearchResponse } from '../core/search.ts';
import { STRINGS } from './strings.ts';

/** 篩選鍵：'OT'、'NT' 或 'OT:law' 這類（FR-015） */
export type FilterKey = Testament | `${Testament}:${Category}`;

const TREE: Array<[Testament, Category[]]> = [
  ['OT', ['law', 'history', 'wisdom', 'prophets']],
  ['NT', ['gospels', 'history', 'epistles', 'revelation']],
];

export function FilterBar({ counts, value, onChange }: { counts: SearchResponse['counts']; value: FilterKey | null; onChange: (k: FilterKey | null) => void }) {
  return (
    <nav class="filter" aria-label={STRINGS.filterLabel}>
      <button type="button" aria-pressed={value === null} data-testid="filter-all" onClick={() => onChange(null)}>
        {STRINGS.filterAll}
      </button>
      {TREE.map(([t, cats]) => (
        <div class="filter-group" key={t}>
          <button type="button" aria-pressed={value === t} data-testid={`filter-${t}`} onClick={() => onChange(t)}>
            {TESTAMENT_LABELS[t]}
            <small data-testid={`count-${t}`}>（{counts.testament[t] ?? 0}）</small>
          </button>
          {cats.map((c) => {
            const k = `${t}:${c}` as const;
            return (
              <button type="button" key={k} aria-pressed={value === k} data-testid={`filter-${k}`} onClick={() => onChange(k)}>
                {CATEGORY_LABELS[c]}
                <small data-testid={`count-${k}`}>（{counts.category[k] ?? 0}）</small>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function toSearchFilter(k: FilterKey | null): { testaments?: Testament[]; categories?: Array<[Testament, Category]> } | undefined {
  if (!k) return undefined;
  if (k === 'OT' || k === 'NT') return { testaments: [k] };
  const [t, c] = k.split(':') as [Testament, Category];
  return { categories: [[t, c]] };
}
