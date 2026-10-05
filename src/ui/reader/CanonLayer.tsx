// 正典層：66 卷依正典順序（FR-013）；本階段只有羅馬書可進入
import { BOOKS } from '../../core/canon.ts';
import type { Layout } from '../../reader/layout.ts';
import { bookTiles } from '../../reader/world.ts';
import { STRINGS } from '../strings.ts';
import { U } from './units.ts';

export function CanonLayer({ layout, px, onEnter }: { layout: Layout; px: number; onEnter: () => void }) {
  return (
    <>
      {bookTiles(layout).map(({ book, rect }) => {
        const b = BOOKS[book - 1]!;
        const open = book === layout.book;
        return (
          <div
            key={book}
            class={`ctile ${b.testament === 'OT' ? 'ot' : 'nt'}${open ? ' open' : ''}`}
            data-testid="canon-book"
            data-book={book}
            style={{ left: `${rect.x * U}px`, top: `${rect.y * U}px`, width: `${rect.w * U}px`, height: `${rect.h * U}px`, fontSize: `${14 * px}px`, borderWidth: `${(open ? 3 : 1) * px}px` }}
            {...(open ? { role: 'button', tabIndex: 0, onClick: onEnter } : {})}
          >
            <span class="cname">{b.name}</span>
            {!open && <small class="cnote">{STRINGS.notAvailable}</small>}
          </div>
        );
      })}
    </>
  );
}
