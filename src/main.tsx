import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Granularity } from './core/search.ts';
import { Attribution } from './ui/Attribution.tsx';
import { ChapterView } from './ui/ChapterView.tsx';
import { toSearchFilter, type FilterKey } from './ui/FilterBar.tsx';
import { ResultList } from './ui/ResultList.tsx';
import { SearchBox } from './ui/SearchBox.tsx';
import { STRINGS } from './ui/strings.ts';
import './ui/style.css';
import { SearchClient } from './worker/client.ts';
import type { ChapterView as ChapterData, PresentedResponse, PresentedResult } from './worker/present.ts';
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
  const seq = useRef(0);

  const client = useMemo(() => {
    const worker = new Worker(new URL('./worker/search.worker.ts', import.meta.url), { type: 'module' });
    return new SearchClient(worker, {
      onReady: setReady,
      onProgress: () => {},
      onError: (code, message) => console.error(code, message),
    });
  }, []);

  useEffect(() => client.init('/data/manifest.json'), [client]);

  const run = async (q: string, g: Granularity, ex: boolean, f: FilterKey | null = filter) => {
    if (!q) return;
    const mySeq = ++seq.current;
    const sf = toSearchFilter(f);
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
    const sf = toSearchFilter(filter);
    const r = await client.search({ query, granularity, expand, offset: results.length, limit: PAGE, ...(sf ? { filter: sf } : {}) });
    setResults([...results, ...r.results]);
  };

  const status = ready.semantic ? STRINGS.statusSemanticReady : ready.keyword ? STRINGS.statusKeywordReady : STRINGS.statusLoadingText;
  const statusId = ready.semantic ? 'status-semantic-ready' : ready.keyword ? 'status-keyword-ready' : 'status-loading';

  return (
    <main>
      <header class="top">
        <h1>{STRINGS.appTitle}</h1>
        <p class="status" data-testid={statusId}>{status}</p>
      </header>
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
          onExpand={(r: PresentedResult) =>
            void client.chapter(r.startRef.book, r.startRef.chapter).then((data) => setChapter({ data, hit: { from: r.startRef.verse, to: r.startRef.chapter === r.endRef.chapter ? r.endRef.verse : 999 } }))
          }
        />
      )}
      <Attribution />
    </main>
  );
}

const root = document.getElementById('app');
if (root) render(<App />, root);
