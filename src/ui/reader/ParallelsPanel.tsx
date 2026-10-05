// 串珠面板（spec 004）：目前段落在整本聖經中語意上可能相關的段落。
// 原位展開比對、可展開全章（原則 2、5）；不顯示分數、只用中性用語（原則 6）；標明依據（原則 9）。
// 面板不經手閱讀器的相機——開、比對、關，閱讀位置都不變（FR-005）。
import { useEffect, useState } from 'preact/hooks';
import type { ChapterView, ParallelItem, ParallelsView } from '../../worker/present.ts';
import { CardItemView } from '../card/CardItemView.tsx';
import { STRINGS } from '../strings.ts';

const key = (r: { book: number; chapter: number; verse: number }) => `${r.book}:${r.chapter}:${r.verse}`;
/** 章節順序（數值比較；字串比較會把 10 排在 9 前面） */
const ord = (r: { chapter: number; verse: number }) => r.chapter * 1000 + r.verse;
const excerpt = (it: ParallelItem) => it.verses.flatMap((v) => v.parts.filter((p) => p.kind === 'text').map((p) => p.value)).join('').replace(/\u3000/g, '').slice(0, 36);

export function ParallelsPanel({ source, load, loadChapter, onClose }: { source: { id: string; verseIdx: number }; load: (verseIdx: number) => Promise<ParallelsView>; loadChapter: (book: number, chapter: number) => Promise<ChapterView>; onClose: () => void }) {
  const [view, setView] = useState<ParallelsView | null>(null);
  const [open, setOpen] = useState<{ item: ParallelItem; chapter?: ChapterView } | null>(null);
  useEffect(() => {
    let live = true;
    setView(null);
    setOpen(null);
    void load(source.verseIdx).then((v) => live && setView(v));
    return () => {
      live = false;
    };
  }, [source.id]);

  const expanded = open
    ? open.chapter
      ? { start: [0, 0, 0] as [number, number, number], end: [0, 0, 0] as [number, number, number], label: open.chapter.label, contextLabel: null, verses: open.chapter.verses.map((v) => ({ ...v, inResult: ord(v.ref) >= ord(open.item.startRef) && ord(v.ref) <= ord(open.item.endRef) })) }
      : { start: [0, 0, 0] as [number, number, number], end: [0, 0, 0] as [number, number, number], label: open.item.label, contextLabel: null, verses: open.item.verses }
    : null;

  return (
    <aside class="parallels-panel" data-testid="parallels-panel" data-source={source.id}>
      <header class="parallels-head">
        <h3>{STRINGS.parallelsTitle}</h3>
        <button type="button" class="link" data-testid="parallels-close" onClick={onClose}>
          {STRINGS.parallelsClose}
        </button>
      </header>
      {!view && <p class="parallels-note">…</p>}
      {view && !view.semanticReady && <p class="parallels-note">{STRINGS.parallelsNotReady}</p>}
      {view && view.semanticReady && (
        <>
          <p class="parallels-basis" data-testid="parallels-basis">
            {STRINGS.parallelsBasis(view.model ?? '')}
          </p>
          {view.items.length === 0 && <p class="parallels-note">{STRINGS.noResults}</p>}
          {open && expanded ? (
            <div class="parallel-expanded" data-testid="parallel-expanded">
              <button type="button" class="link" data-testid="parallel-back" onClick={() => setOpen(null)}>
                {STRINGS.parallelsBack}
              </button>
              <CardItemView v={expanded} />
              {!open.chapter && (
                <button type="button" class="link" data-testid="parallel-expand-chapter" onClick={() => void loadChapter(open.item.startRef.book, open.item.startRef.chapter).then((chapter) => setOpen({ item: open.item, chapter }))}>
                  {STRINGS.expandChapter}
                </button>
              )}
            </div>
          ) : (
            <ol class="parallels-list">
              {view.items.map((it) => (
                <li key={key(it.startRef)} class="parallel-item" data-testid="parallel-item" data-tier={it.tier} data-start={key(it.startRef)} data-end={key(it.endRef)}>
                  <button type="button" class="parallel-open" data-testid="parallel-open" onClick={() => setOpen({ item: it })}>
                    <span class="parallel-label">{it.label}</span>
                    <span class="parallel-excerpt">{excerpt(it)}…</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </aside>
  );
}
