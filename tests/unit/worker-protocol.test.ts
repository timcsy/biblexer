// 守護：contracts/search-api.md §3 Worker 訊息協定
import { describe, expect, test, vi } from 'vitest';
import { ERROR_CODES, handleMessage, type Engine, type WorkerOut } from '../../src/worker/protocol.ts';

function fakeEngine(over: Partial<Engine> = {}): Engine {
  return {
    init: vi.fn(async () => ({ keyword: true, semantic: true })),
    loadSemantic: vi.fn(async () => ({ keyword: true, semantic: true })),
    search: vi.fn(async () => ({ results: [], total: 0, counts: { testament: {}, category: {} }, semanticReady: true, truncated: false, reference: null, expansions: [], granularity: 'passage' as const })),
    chapter: vi.fn(async () => ({ label: '', verses: [], passageStarts: [] })),
    book: vi.fn(async () => ({ book: 45, verses: [], paragraphStarts: [] })),
    card: vi.fn(async () => [null]),
    parallels: vi.fn(async () => ({ semanticReady: false, model: null, items: [] })),
    ...over,
  };
}

describe('Worker 協定', () => {
  test('init → ready；search → result（帶相同 id）；chapter → chapterResult', async () => {
    const out: WorkerOut[] = [];
    const post = (m: WorkerOut) => out.push(m);
    const e = fakeEngine();
    await handleMessage(e, { type: 'init', manifestUrl: '/data/manifest.json' }, post);
    await handleMessage(e, { type: 'search', id: 7, request: { query: '神' } }, post);
    await handleMessage(e, { type: 'chapter', id: 8, book: 43, chapter: 2 }, post);
    expect(out.map((m) => m.type)).toEqual(['ready', 'result', 'chapterResult']);
    expect(out[1]).toMatchObject({ type: 'result', id: 7 });
    expect(out[2]).toMatchObject({ type: 'chapterResult', id: 8 });
  });

  test('book → bookResult（帶相同 id）', async () => {
    const out: WorkerOut[] = [];
    const e = fakeEngine();
    await handleMessage(e, { type: 'book', id: 9, book: 45 }, (m) => out.push(m));
    expect(e.book).toHaveBeenCalledWith(45);
    expect(out[0]).toMatchObject({ type: 'bookResult', id: 9, data: { book: 45 } });
  });

  test('card → cardResult（帶相同 id）', async () => {
    const out: WorkerOut[] = [];
    const e = fakeEngine();
    await handleMessage(e, { type: 'card', id: 11, items: [{ start: [45, 8, 28], end: [45, 8, 28] }] }, (m) => out.push(m));
    expect(out[0]).toMatchObject({ type: 'cardResult', id: 11, items: [null] });
  });

  test('parallels → parallelsResult（帶相同 id）', async () => {
    const out: WorkerOut[] = [];
    const e = fakeEngine();
    await handleMessage(e, { type: 'parallels', id: 12, book: 45, verseIdx: 3 }, (m) => out.push(m));
    expect(e.parallels).toHaveBeenCalledWith(45, 3);
    expect(out[0]).toMatchObject({ type: 'parallelsResult', id: 12, data: { semanticReady: false, items: [] } });
  });

  test('錯誤以固定代碼回報，訊息帶原請求 id', async () => {
    const out: WorkerOut[] = [];
    const e = fakeEngine({ search: vi.fn(async () => { throw new Error('boom'); }) });
    await handleMessage(e, { type: 'search', id: 3, request: { query: '神' } }, (m) => out.push(m));
    expect(out[0]).toMatchObject({ type: 'error', id: 3, code: 'INTERNAL' });
    expect(ERROR_CODES).toEqual(['NOT_DOWNLOADED', 'QUOTA', 'CORRUPT', 'INTERNAL']);
  });

  test('init 可延後語意（semantic: false）；之後以 loadSemantic 載入並回報 ready', async () => {
    const out: WorkerOut[] = [];
    const e = fakeEngine({ init: vi.fn(async () => ({ keyword: true, semantic: false })) });
    await handleMessage(e, { type: 'init', manifestUrl: '/data/manifest.json', semantic: false }, (m) => out.push(m));
    expect(e.init).toHaveBeenCalledWith('/data/manifest.json', expect.any(Function), false);
    await handleMessage(e, { type: 'loadSemantic' }, (m) => out.push(m));
    expect(out).toEqual([
      { type: 'ready', keyword: true, semantic: false },
      { type: 'ready', keyword: true, semantic: true },
    ]);
  });
});

