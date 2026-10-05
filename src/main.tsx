import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { boot, type BootState } from './pwa/boot.ts';
import { ProgressBanner } from './ui/ProgressBanner.tsx';
import type { Granularity } from './core/search.ts';
import { Attribution } from './ui/Attribution.tsx';
import { addItem, hasItem, moveItem, removeItem, EMPTY_CARD, type Card, type CardItem } from './core/card.ts';
import { CardPanel } from './ui/card/CardPanel.tsx';
import { PrintSheet } from './ui/card/PrintSheet.tsx';
import { loadCard, saveCard } from './ui/card/store.ts';
import { ChapterView } from './ui/ChapterView.tsx';
import { Reader } from './ui/reader/Reader.tsx';
import { toSearchFilter, type FilterKey } from './ui/FilterBar.tsx';
import { ResultList } from './ui/ResultList.tsx';
import { SearchBox } from './ui/SearchBox.tsx';
import { STRINGS } from './ui/strings.ts';
import './ui/style.css';
import { SearchClient } from './worker/client.ts';
import type { BookData, CardView, ChapterView as ChapterData, PresentedResponse, PresentedResult } from './worker/present.ts';
import type { ReadyState } from './worker/protocol.ts';

const PAGE = 10;

function App() {
  const [ready, setReady] = useState<ReadyState>({ keyword: false, semantic: false });
  const [query, setQuery] = useState('');
  const [granularity, setGranularity] = useState<Granularity>('passage');
  const [expand, setExpand] = useState(true);
  const [response, setResponse] = useState<PresentedResponse | null>(null);
  const [results, setResults] = useState<PresentedResponse['results']>([]);
  const [filter, setFilter] = useState<FilterKey | null>(null);
  const [chapter, setChapter] = useState<{ data: ChapterData; hit: { from: number; to: number } } | null>(null);
  // 全本閱讀器（spec 005）：書卷資料依需要取得、快取在記憶體
  const books = useRef(new Map<number, BookData>());
  const [bookData, setBookData] = useState<BookData | null>(null);
  const [reader, setReader] = useState<{ book: number; verseIdx: number; hit?: { from: number; to: number } } | null>(null);
  const lastBook = useRef(45);
  const seq = useRef(0);

  // 經文卡（spec 003）：只存在這台裝置；顯示與列印時由 Worker 取出所在段落
  const [card, setCardState] = useState<Card>(loadCard);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardViews, setCardViews] = useState<Array<CardView | null>>([]);
  const setCard = (next: Card) => {
    setCardState(next);
    saveCard(next);
  };
  const itemOf = (r: PresentedResult): CardItem => ({ start: [r.startRef.book, r.startRef.chapter, r.startRef.verse], end: [r.endRef.book, r.endRef.chapter, r.endRef.verse] });

  const [bootState, setBootState] = useState<BootState>({ kind: 'starting' });
  const clientRef = useRef<SearchClient | null>(null);
  const newClient = () => {
    const worker = new Worker(new URL('./worker/search.worker.ts', import.meta.url), { type: 'module' });
    return new SearchClient(worker, {
      onReady: setReady,
      onProgress: () => {},
      onError: (code, message) => console.error(code, message),
    });
  };

  // 開機：Service Worker 接管後才建立 Worker，讓 Worker 的請求也走離線快取
  useEffect(() => {
    void boot({
      onState: setBootState,
      initWorker: (semantic) => {
        clientRef.current = newClient();
        clientRef.current.init('/data/manifest.json', semantic);
      },
      loadSemantic: () => clientRef.current?.loadSemantic(),
    });
  }, []);

  const run = async (q: string, g: Granularity, ex: boolean, f: FilterKey | null = filter) => {
    if (!q) return;
    const mySeq = ++seq.current;
    const sf = toSearchFilter(f);
    const client = clientRef.current;
    if (!client) return;
    const r = await client.search({ query: q, granularity: g, expand: ex, limit: PAGE, ...(sf ? { filter: sf } : {}) });
    if (mySeq !== seq.current) return;
    setQuery(q);
    setFilter(f);
    setChapter(null);
    setResponse(r);
    setResults(r.results);
  };

  // 語意就緒時，畫面上的查詢自動以混合檢索更新（FR-020）
  useEffect(() => {
    if (ready.semantic && query) void run(query, granularity, expand);
  }, [ready.semantic]);

  const loadMore = async () => {
    const client = clientRef.current;
    if (!client) return;
    const sf = toSearchFilter(filter);
    const r = await client.search({ query, granularity, expand, offset: results.length, limit: PAGE, ...(sf ? { filter: sf } : {}) });
    setResults([...results, ...r.results]);
  };

  const loadBook = async (book: number) => {
    let d = books.current.get(book);
    if (!d) {
      d = await clientRef.current!.book(book);
      books.current.set(book, d);
    }
    setBookData(d);
    lastBook.current = book;
    return d;
  };
  const openReader = async (book = lastBook.current, start: { verseIdx: number; hit?: { from: number; to: number } } = { verseIdx: 0 }) => {
    await loadBook(book);
    setReader({ book, ...start });
  };

  // FR-015（spec 005：任何書卷）：開在命中段落起點並標示命中範圍；搜尋畫面留在底下，返回時查詢與捲動位置不變（FR-016）
  const openResultInReader = async (r: PresentedResult) => {
    const book = r.startRef.book;
    const d = await loadBook(book);
    const same = (a: { chapter: number; verse: number }, b: { chapter: number; verse: number }) => a.chapter === b.chapter && a.verse === b.verse;
    const from = d.verses.findIndex((v) => same(v.ref, r.startRef));
    const to = d.verses.findIndex((v) => same(v.ref, r.endRef));
    if (from < 0 || to < 0) return;
    setReader({ book, verseIdx: from, hit: { from, to } });
  };

  useEffect(() => {
    if (!ready.keyword || !clientRef.current) return;
    let live = true;
    void clientRef.current.card(card.items).then((v) => live && setCardViews(v));
    return () => {
      live = false;
    };
  }, [card, ready.keyword]);

  const status = ready.semantic ? STRINGS.statusSemanticReady : ready.keyword ? STRINGS.statusKeywordReady : STRINGS.statusLoadingText;
  const statusId = ready.semantic ? 'status-semantic-ready' : ready.keyword ? 'status-keyword-ready' : 'status-loading';

  return (
    <main>
      <header class="top">
        <div class="top-actions">
          <h1>{STRINGS.appTitle}</h1>
          <button type="button" class="open-reader" data-testid="open-reader" disabled={!ready.keyword} onClick={() => void openReader()}>
            {STRINGS.readerTitle}
          </button>
          <button type="button" class="open-reader" data-testid="card-toggle" aria-pressed={cardOpen} onClick={() => setCardOpen(!cardOpen)}>
            {STRINGS.cardToggle(card.items.length)}
          </button>
        </div>
        <p class="status" data-testid={statusId}>{status}</p>
        <ProgressBanner state={bootState} />
      </header>
      {cardOpen && <CardPanel card={card} views={cardViews} onMove={(i, d) => setCard(moveItem(card, i, d))} onRemove={(i) => setCard(removeItem(card, i))} onClear={() => setCard(EMPTY_CARD)} />}
      <SearchBox onSearch={(q) => void run(q, granularity, expand, null)} disabled={!ready.keyword} />
      {chapter && <ChapterView data={chapter.data} hit={chapter.hit} onClose={() => setChapter(null)} />}
      {response && !chapter && (
        <ResultList
          query={query}
          response={response}
          results={results}
          granularity={granularity}
          expand={expand}
          onGranularity={(g) => {
            setGranularity(g);
            void run(query, g, expand);
          }}
          onToggleExpand={() => {
            setExpand(!expand);
            void run(query, granularity, !expand);
          }}
          onLoadMore={() => void loadMore()}
          filter={filter}
          onFilter={(k) => void run(query, granularity, expand, k)}
          onOpenInReader={(r: PresentedResult) => void openResultInReader(r)}
          onAddToCard={(r: PresentedResult) => setCard(addItem(card, itemOf(r)))}
          inCard={(r: PresentedResult) => hasItem(card, itemOf(r))}
          onExpand={(r: PresentedResult) =>
            void clientRef.current?.chapter(r.startRef.book, r.startRef.chapter).then((data) => setChapter({ data, hit: { from: r.startRef.verse, to: r.startRef.chapter === r.endRef.chapter ? r.endRef.verse : 999 } }))
          }
        />
      )}
      <Attribution />
      {reader && bookData && bookData.book === reader.book && (
        <Reader
          key={JSON.stringify(reader)}
          data={bookData}
          start={reader}
          onBack={() => setReader(null)}
          onOpenBook={(b) => void openReader(b)}
          onAddToCard={(it) => setCard(addItem(card, it))}
          loadParallels={(v) => clientRef.current!.parallels(reader.book, v)}
          loadChapter={(b, c) => clientRef.current!.chapter(b, c)}
        />
      )}
      <PrintSheet views={cardViews} />
    </main>
  );
}

const root = document.getElementById('app');
if (root) render(<App />, root);
