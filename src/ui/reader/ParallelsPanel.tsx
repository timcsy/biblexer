// 串珠面板（spec 004）：分三層——新約引用舊約（UBS 明引）→ TSK → 語意上可能相關的段落（FR-009）。
// 每層各自署名（原則 9）、可收起（FR-010，記在這個瀏覽器）；某層在這一段沒有參照時不顯示。
// 原位展開比對、可展開全章（原則 2、5）；不顯示分數、只用中性用語（原則 6）。
// 面板不經手閱讀器的相機——開、比對、關，閱讀位置都不變（FR-005）。
import { useEffect, useState } from 'preact/hooks';
import type { ChapterView, ParallelItem, ParallelsView } from '../../worker/present.ts';
import { CardItemView } from '../card/CardItemView.tsx';
import { STRINGS } from '../strings.ts';

const key = (r: { book: number; chapter: number; verse: number }) => `${r.book}:${r.chapter}:${r.verse}`;
/** 章節順序（數值比較；字串比較會把 10 排在 9 前面） */
const ord = (r: { chapter: number; verse: number }) => r.chapter * 1000 + r.verse;
const excerpt = (it: ParallelItem) => it.verses.flatMap((v) => v.parts.filter((p) => p.kind === 'text').map((p) => p.value)).join('').replace(/　/g, '').slice(0, 36);

type Tier = ParallelItem['tier'];
const TIERS: Tier[] = ['quote', 'tsk', 'semantic'];
const HIDDEN_KEY = 'biblexer.parallels.hidden';
/** TSK 一段常有上百筆：預設只顯示前幾筆，其餘按「顯示全部」才展開，不把語意近鄰推到很下面 */
const TSK_PREVIEW = 10;
const loadHidden = (): Set<Tier> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as Tier[]);
  } catch {
    return new Set();
  }
};

export function ParallelsPanel({ source, load, loadChapter, onClose }: { source: { id: string; verseIdx: number }; load: (verseIdx: number) => Promise<ParallelsView>; loadChapter: (book: number, chapter: number) => Promise<ChapterView>; onClose: () => void }) {
  const [view, setView] = useState<ParallelsView | null>(null);
  const [open, setOpen] = useState<{ item: ParallelItem; chapter?: ChapterView } | null>(null);
  const [hidden, setHidden] = useState<Set<Tier>>(loadHidden);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    let live = true;
    setView(null);
    setOpen(null);
    setShowAll(false);
    void load(source.verseIdx).then((v) => live && setView(v));
    return () => {
      live = false;
    };
  }, [source.id]);

  const toggle = (tier: Tier) => {
    const next = new Set(hidden);
    if (next.has(tier)) next.delete(tier);
    else next.add(tier);
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    } catch {
      /* 不能存就只在這次有效 */
    }
  };

  const expanded = open
    ? open.chapter
      ? { start: [0, 0, 0] as [number, number, number], end: [0, 0, 0] as [number, number, number], label: open.chapter.label, contextLabel: null, verses: open.chapter.verses.map((v) => ({ ...v, inResult: ord(v.ref) >= ord(open.item.startRef) && ord(v.ref) <= ord(open.item.endRef) })) }
      : { start: [0, 0, 0] as [number, number, number], end: [0, 0, 0] as [number, number, number], label: open.item.label, contextLabel: null, verses: open.item.verses }
    : null;

  const title: Record<Tier, string> = { quote: STRINGS.parallelsQuoteTitle, tsk: STRINGS.parallelsTskTitle, semantic: STRINGS.parallelsTitle };
  const basis = (tier: Tier) => (tier === 'quote' ? STRINGS.parallelsQuoteBasis : tier === 'tsk' ? STRINGS.parallelsTskBasis : STRINGS.parallelsBasis(view?.model ?? ''));

  const layer = (tier: Tier) => {
    const all = view!.items.filter((it) => it.tier === tier);
    const items = tier === 'tsk' && !showAll ? all.slice(0, TSK_PREVIEW) : all;
    // 明引、TSK：這一段沒有參照就不顯示該層；語意近鄰：一律顯示（準備中、沒有找到）
    if (tier !== 'semantic' && all.length === 0) return null;
    const shown = !hidden.has(tier);
    return (
      <section key={tier} class="parallels-layer" data-testid="parallels-layer" data-tier={tier}>
        <header class="parallels-layer-head">
          <h4>{title[tier]}</h4>
          <button type="button" class="link" data-testid="parallels-layer-toggle" aria-expanded={shown} onClick={() => toggle(tier)}>
            {shown ? STRINGS.parallelsLayerHide : STRINGS.parallelsLayerShow}
          </button>
        </header>
        {shown &&
          (tier === 'semantic' && !view!.semanticReady ? (
            <p class="parallels-note">{STRINGS.parallelsNotReady}</p>
          ) : (
            <>
              <p class="parallels-basis" data-testid={tier === 'semantic' ? 'parallels-basis' : 'parallels-attribution'}>
                {basis(tier)}
              </p>
              {items.length === 0 && <p class="parallels-note">{STRINGS.noResults}</p>}
              <ol class="parallels-list">
                {items.map((it) => (
                  <li key={`${key(it.startRef)}-${key(it.endRef)}`} class="parallel-item" data-testid="parallel-item" data-tier={it.tier} data-start={key(it.startRef)} data-end={key(it.endRef)}>
                    <button type="button" class="parallel-open" data-testid="parallel-open" onClick={() => setOpen({ item: it })}>
                      <span class="parallel-label">{it.label}</span>
                      <span class="parallel-excerpt">{excerpt(it)}…</span>
                    </button>
                  </li>
                ))}
              </ol>
              {items.length < all.length && (
                <button type="button" class="link" data-testid="parallels-show-all" onClick={() => setShowAll(true)}>
                  {STRINGS.parallelsShowAll(all.length)}
                </button>
              )}
            </>
          ))}
      </section>
    );
  };

  return (
    <aside class="parallels-panel" data-testid="parallels-panel" data-source={source.id}>
      <header class="parallels-head">
        <h3>{STRINGS.parallelsPanelTitle}</h3>
        <button type="button" class="link" data-testid="parallels-close" onClick={onClose}>
          {STRINGS.parallelsClose}
        </button>
      </header>
      {!view && <p class="parallels-note">…</p>}
      {view &&
        (open && expanded ? (
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
          TIERS.map(layer)
        ))}
    </aside>
  );
}
