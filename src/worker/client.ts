// 型別化的 Worker 用戶端：以請求 id 對應回應
import type { SearchRequest } from '../core/search.ts';
import type { ReadyState, WorkerIn, WorkerOut } from './protocol.ts';
import type { CardItem } from '../core/card.ts';
import type { BookData, CardView, ChapterView, ParallelsView, PresentedResponse } from './present.ts';

export interface ClientEvents {
  onReady(s: ReadyState): void;
  onProgress(phase: string, loaded: number, total: number): void;
  onError(code: string, message: string): void;
}

export class SearchClient {
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(
    private readonly worker: { postMessage(m: WorkerIn): void; onmessage: ((e: MessageEvent<WorkerOut>) => void) | null },
    private readonly events: ClientEvents,
  ) {
    worker.onmessage = (e) => this.receive(e.data);
  }

  init(manifestUrl: string, semantic = true): void {
    this.worker.postMessage({ type: 'init', manifestUrl, semantic });
  }

  loadSemantic(): void {
    this.worker.postMessage({ type: 'loadSemantic' });
  }

  search(request: SearchRequest): Promise<PresentedResponse> {
    return this.request((id) => ({ type: 'search', id, request }));
  }

  chapter(book: number, chapter: number): Promise<ChapterView> {
    return this.request((id) => ({ type: 'chapter', id, book, chapter }));
  }

  book(book: number): Promise<BookData> {
    return this.request((id) => ({ type: 'book', id, book }));
  }

  card(items: CardItem[]): Promise<Array<CardView | null>> {
    return this.request((id) => ({ type: 'card', id, items }));
  }

  parallels(book: number, verseIdx: number): Promise<ParallelsView> {
    return this.request((id) => ({ type: 'parallels', id, book, verseIdx }));
  }

  private request<T>(make: (id: number) => WorkerIn): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage(make(id));
    });
  }

  private receive(m: WorkerOut): void {
    if (m.type === 'ready') this.events.onReady({ keyword: m.keyword, semantic: m.semantic });
    else if (m.type === 'progress') this.events.onProgress(m.phase, m.loaded, m.total);
    else if (m.type === 'result' || m.type === 'chapterResult' || m.type === 'bookResult' || m.type === 'cardResult' || m.type === 'parallelsResult') {
      const p = this.pending.get(m.id);
      this.pending.delete(m.id);
      p?.resolve(m.type === 'result' ? m.response : m.type === 'chapterResult' ? m.view : m.type === 'bookResult' || m.type === 'parallelsResult' ? m.data : m.items);
    } else {
      const p = m.id !== undefined ? this.pending.get(m.id) : undefined;
      if (p && m.id !== undefined) {
        this.pending.delete(m.id);
        p.reject(new Error(m.message));
      } else this.events.onError(m.code, m.message);
    }
  }
}
