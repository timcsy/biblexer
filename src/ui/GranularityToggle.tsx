import type { Granularity } from '../core/search.ts';
import { STRINGS } from './strings.ts';

const OPTIONS: Array<[Granularity, string]> = [
  ['verse', STRINGS.granularityVerse],
  ['passage', STRINGS.granularityPassage],
  ['chapter', STRINGS.granularityChapter],
];

export function GranularityToggle({ value, onChange }: { value: Granularity; onChange: (g: Granularity) => void }) {
  return (
    <div class="toggle" role="group" aria-label={STRINGS.granularityLabel}>
      <span class="toggle-label">{STRINGS.granularityLabel}</span>
      {OPTIONS.map(([g, label]) => (
        <button key={g} type="button" data-testid={`granularity-${g}`} aria-pressed={value === g} onClick={() => onChange(g)}>
          {label}
        </button>
      ))}
    </div>
  );
}
