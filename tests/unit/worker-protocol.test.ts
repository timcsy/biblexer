// 守護：contracts/search-api.md §3 Worker 訊息協定
import { describe, expect, test, vi } from 'vitest';
import { ERROR_CODES, handleMessage, type Engine, type WorkerOut } from '../../src/worker/protocol.ts';

function fakeEngine(over: Partial<Engine> = {}): Engine {
  return {
    init: vi.fn(async () => ({ keyword: true, semantic: true })),
    search: vi.fn(async () => ({ results: [], total: 0, counts: { testament: {}, category: {} }, semanticReady: true, truncated: false, reference: null, expansions: [] })),
    chapter: vi.fn(async () => ({ verses: [], passages: [] })),
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

  test('錯誤以固定代碼回報，訊息帶原請求 id', async () => {
    const out: WorkerOut[] = [];
    const e = fakeEngine({ search: vi.fn(async () => { throw new Error('boom'); }) });
    await handleMessage(e, { type: 'search', id: 3, request: { query: '神' } }, (m) => out.push(m));
    expect(out[0]).toMatchObject({ type: 'error', id: 3, code: 'INTERNAL' });
    expect(ERROR_CODES).toEqual(['NOT_DOWNLOADED', 'QUOTA', 'CORRUPT', 'INTERNAL']);
  });
});
