// 正典帶（常駐，所有層級都有）：66 卷依章數比例分段、依約與類別著色，標出目前書卷——我在整本聖經的哪裡。
// 放在工具列下方、高度固定（不改變閱讀區高度，避免重新量測）。
import { useMemo } from 'preact/hooks';
import { BOOKS } from '../../core/canon.ts';
import { canonStrip } from '../../reader/canonTree.ts';
import { STRINGS } from '../strings.ts';

export function CanonStrip({ focusBook, onPick }: { focusBook: number; onPick: (book: number) => void }) {
  const strip = useMemo(() => canonStrip(), []);
  const here = strip[focusBook - 1]!;
  const hereX = (here.x0 + here.x1) / 2;
  return (
    <div class="canon-strip" data-testid="canon-strip">
      <div class="strip-bar">
        {strip.map((s) => (
          <span
            key={s.book}
            class={`strip-seg p-${s.palette.replace(':', '-')}${s.book === focusBook ? ' current' : ''}`}
            data-testid="strip-seg"
            data-book={s.book}
            title={BOOKS[s.book - 1]!.name}
            role="button"
            {...(s.book === focusBook ? { 'aria-current': 'location' } : {})}
            style={{ left: `${s.x0 * 100}%`, width: `${(s.x1 - s.x0) * 100}%` }}
            onClick={() => onPick(s.book)}
          />
        ))}
      </div>
      <div class="strip-labels">
        <span>{STRINGS.oldTestament}</span>
        <span class="strip-here" style={{ left: `${hereX * 100}%` }}>
          {BOOKS[focusBook - 1]!.name}
        </span>
        {/* 「新約」與目前書卷名稱太近時只留書卷名稱 */}
        {Math.abs(hereX - strip[39]!.x0) > 0.06 && <span style={{ left: `${strip[39]!.x0 * 100}%` }}>{STRINGS.newTestament}</span>}
      </div>
    </div>
  );
}
