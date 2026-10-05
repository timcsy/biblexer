// 列印頁（spec 003 FR-006～FR-012）：只含經文段落（出處與段落範圍）、空白書寫欄位、資料來源署名。
// 不得有任何系統產生的文字（原則 4）——由 e2e/card.spec.ts 的白名單守護。
import type { CardView } from '../../worker/present.ts';
import { STRINGS } from '../strings.ts';
import { CardItemView } from './CardItemView.tsx';

const WRITE_LINES = 4;

export function PrintSheet({ views }: { views: Array<CardView | null> }) {
  return (
    <section class="print-sheet" data-testid="print-sheet" aria-hidden="true">
      {views.map((v, i) =>
        v ? (
          <article key={i} class="print-item">
            <CardItemView v={v} />
            <div class="write-lines" data-testid="write-lines">
              {Array.from({ length: WRITE_LINES }, (_, k) => (
                <div key={k} class="write-line" />
              ))}
            </div>
          </article>
        ) : null,
      )}
      <footer class="print-attr">
        <span data-kind="attribution">{STRINGS.attributionText}</span>
      </footer>
    </section>
  );
}
