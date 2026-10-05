// 經文卡面板（spec 003 US1、US2）：整理順序、移除、清空、列印。順序完全由使用者決定（原則 6）
import { useState } from 'preact/hooks';
import type { Card } from '../../core/card.ts';
import type { CardView } from '../../worker/present.ts';
import { STRINGS } from '../strings.ts';
import { CardItemView } from './CardItemView.tsx';

const key = (k: [number, number, number]) => k.join(':');

export function CardPanel({ card, views, onMove, onRemove, onClear }: { card: Card; views: Array<CardView | null>; onMove: (i: number, dir: -1 | 1) => void; onRemove: (i: number) => void; onClear: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const empty = card.items.length === 0;
  return (
    <section class="card-panel" data-testid="card-panel">
      <header class="card-head">
        <h2>{STRINGS.cardTitle}</h2>
        <span class="card-actions">
          <button type="button" data-testid="card-print" disabled={empty} onClick={() => window.print()}>
            {STRINGS.cardPrint}
          </button>
          {confirming ? (
            <button
              type="button"
              class="danger"
              data-testid="card-clear-confirm"
              onClick={() => {
                setConfirming(false);
                onClear();
              }}
            >
              {STRINGS.cardClearConfirm}
            </button>
          ) : (
            <button type="button" data-testid="card-clear" disabled={empty} onClick={() => setConfirming(true)}>
              {STRINGS.cardClear}
            </button>
          )}
        </span>
      </header>
      {empty && <p class="card-empty">{STRINGS.cardEmpty}</p>}
      <ol class="card-list">
        {card.items.map((it, i) => {
          const v = views[i];
          return (
            <li key={`${key(it.start)}-${key(it.end)}`} class="card-item" data-testid="card-item" data-start={key(it.start)} data-end={key(it.end)}>
              {v ? <CardItemView v={v} /> : <p class="card-missing">{`${key(it.start)}–${key(it.end)}`}</p>}
              <footer class="card-item-actions">
                <button type="button" class="link" data-testid="card-up" disabled={i === 0} onClick={() => onMove(i, -1)}>
                  {STRINGS.cardUp}
                </button>
                <button type="button" class="link" data-testid="card-down" disabled={i === card.items.length - 1} onClick={() => onMove(i, 1)}>
                  {STRINGS.cardDown}
                </button>
                <button type="button" class="link" data-testid="card-remove" onClick={() => onRemove(i)}>
                  {STRINGS.cardRemove}
                </button>
              </footer>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
