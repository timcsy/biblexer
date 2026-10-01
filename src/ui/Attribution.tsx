import { STRINGS } from './strings.ts';

// FR-028／衍生原則 9：凡含人為判斷或第三方資料者，都標明來源；FR-029：換說法提示
export function Attribution() {
  return (
    <footer class="attribution">
      <p class="rephrase" data-testid="rephrase-hint">{STRINGS.rephraseHint}</p>
      <details data-testid="attribution" open>
        <summary>{STRINGS.attributionTitle}</summary>
        <p>{STRINGS.attributionText}</p>
        <p>{STRINGS.attributionLexicon}</p>
      </details>
    </footer>
  );
}
