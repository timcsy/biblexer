// 經文卡的一段：出處、段落經文（所選經節標示）。文字一律放在 data-kind 白名單元素內（spec 003 FR-009、research R4）
import type { CardView } from '../../worker/present.ts';

export function CardItemView({ v }: { v: CardView }) {
  return (
    <>
      <p class="card-ref">
        <span data-kind="ref">{v.label}</span>
        {v.contextLabel && <span data-kind="ref" class="card-context">{`（${v.contextLabel}）`}</span>}
      </p>
      <p class="card-text">
        {v.verses.map((x) =>
          x.merged ? null : (
            <span key={`${x.ref.chapter}:${x.ref.verse}`} class={x.inResult ? 'card-verse selected' : 'card-verse'} {...(x.inResult && v.verses.some((y) => !y.inResult) ? { 'data-selected': 'true' } : {})}>
              <sup data-kind="vnum">{x.mergedTo ? `${x.ref.verse}–${x.mergedTo}` : x.ref.verse}</sup>
              {x.parts.map((p, i) => (
                <span key={i} data-kind={p.kind === 'note' ? 'note' : 'text'} class={p.kind === 'note' ? 'note' : undefined}>
                  {p.value}
                </span>
              ))}
            </span>
          ),
        )}
      </p>
    </>
  );
}
