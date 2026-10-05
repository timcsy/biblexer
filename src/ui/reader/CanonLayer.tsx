// 正典層：66 卷依正典順序（FR-013）；每一卷都可進入（spec 005），目前書卷位於世界原點
import { BOOKS } from '../../core/canon.ts';
import type { Layout } from '../../reader/layout.ts';
import { bookTiles } from '../../reader/world.ts';
import { U } from './units.ts';

export function CanonLayer({ layout, px, onEnter }: { layout: Layout; px: number; onEnter: (book: number) => void }) {
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
            role="button"
            tabIndex={0}
            onClick={() => onEnter(book)}
            {...(open ? { 'aria-current': 'location' } : {})}
          >
            <span class="cname">{b.name}</span>
          </div>
        );
      })}
    </>
  );
}
