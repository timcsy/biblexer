import type { Expansion } from '../core/expand.ts';
import { STRINGS } from './strings.ts';

const sourceLabel = (via: string) => (via === 'moedict' ? STRINGS.sourceMoedict : `${STRINGS.sourceStrongs} ${via.replace('strongs:', '')}`);

// FR-027：列出實際擴充的詞與各自的來源；可關閉
export function ExpansionNote({ expansions, enabled, onToggle }: { expansions: Expansion[]; enabled: boolean; onToggle: () => void }) {
  return (
    <div class="expansion">
      {enabled && expansions.length > 0 && (
        <p data-testid="expansion-note">
          {STRINGS.expansionPrefix}
          {expansions.map((e) => (
            <span key={e.word} class="exp-word">
              「{e.word}」→
              {e.terms.map((t) => (
                <span key={t.term} class="exp-term" title={sourceLabel(t.via)}>
                  {t.term}
                  <small>（{sourceLabel(t.via)}）</small>
                </span>
              ))}
            </span>
          ))}
        </p>
      )}
      <button type="button" class="link" data-testid="expansion-toggle" onClick={onToggle}>
        {enabled ? STRINGS.expansionOff : STRINGS.expansionOn}
      </button>
    </div>
  );
}
