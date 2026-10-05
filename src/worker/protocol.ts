// Worker 訊息協定（contracts/search-api.md §3）
import type { SearchRequest } from '../core/search.ts';
import type { CardItem } from '../core/card.ts';
import type { BookData, CardView, ChapterView, ParallelsView, PresentedResponse } from './present.ts';

export const ERROR_CODES = ['NOT_DOWNLOADED', 'QUOTA', 'CORRUPT', 'INTERNAL'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ReadyState {
  keyword: boolean;
  semantic: boolean;
}

export type WorkerIn =
  | { type: 'init'; manifestUrl: string; semantic?: boolean }
  | { type: 'loadSemantic' }
  | { type: 'search'; id: number; request: SearchRequest }
  | { type: 'chapter'; id: number; book: number; chapter: number }
  | { type: 'book'; id: number; book: number }
  | { type: 'card'; id: number; items: CardItem[] }
  | { type: 'parallels'; id: number; book: number; verseIdx: number };

export type WorkerOut =
  | ({ type: 'ready' } & ReadyState)
  | { type: 'progress'; phase: 'text' | 'model' | 'vectors'; loaded: number; total: number }
  | { type: 'result'; id: number; response: PresentedResponse }
  | { type: 'chapterResult'; id: number; view: ChapterView }
  | { type: 'bookResult'; id: number; data: BookData }
  | { type: 'cardResult'; id: number; items: Array<CardView | null> }
  | { type: 'parallelsResult'; id: number; data: ParallelsView }
  | { type: 'error'; id?: number; code: ErrorCode; message: string };

export interface Engine {
  init(manifestUrl: string, onStage?: (s: ReadyState) => void, semantic?: boolean): Promise<ReadyState>;
  /** 延後載入語意檢索（向量與模型）；init 時 semantic 為 false 才需要 */
  loadSemantic(): Promise<ReadyState>;
  search(request: SearchRequest): Promise<PresentedResponse>;
  chapter(book: number, chapter: number): Promise<ChapterView>;
  book(book: number): Promise<BookData>;
  card(items: CardItem[]): Promise<Array<CardView | null>>;
  /** 串珠：某書第 verseIdx 節（相對於本書第一節）所在段落的語意近鄰 */
  parallels(book: number, verseIdx: number): Promise<ParallelsView>;
}

export class EngineError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const codeOf = (e: unknown): ErrorCode => (e instanceof EngineError ? e.code : 'INTERNAL');

/** 把一則訊息交給引擎處理，並把結果以協定格式送出（與 postMessage 解耦，方便測試） */
export async function handleMessage(engine: Engine, msg: WorkerIn, post: (m: WorkerOut) => void): Promise<void> {
  try {
    if (msg.type === 'init') {
      const semantic = msg.semantic ?? true;
      const final = await engine.init(msg.manifestUrl, semantic ? (s) => post({ type: 'ready', ...s }) : () => {}, semantic);
      post({ type: 'ready', ...final });
    } else if (msg.type === 'loadSemantic') {
      post({ type: 'ready', ...(await engine.loadSemantic()) });
    } else if (msg.type === 'search') {
      post({ type: 'result', id: msg.id, response: await engine.search(msg.request) });
    } else if (msg.type === 'parallels') {
      post({ type: 'parallelsResult', id: msg.id, data: await engine.parallels(msg.book, msg.verseIdx) });
    } else if (msg.type === 'card') {
      post({ type: 'cardResult', id: msg.id, items: await engine.card(msg.items) });
    } else if (msg.type === 'book') {
      post({ type: 'bookResult', id: msg.id, data: await engine.book(msg.book) });
    } else {
      post({ type: 'chapterResult', id: msg.id, view: await engine.chapter(msg.book, msg.chapter) });
    }
  } catch (e) {
    const id = msg.type === 'init' || msg.type === 'loadSemantic' ? undefined : msg.id;
    post({ type: 'error', ...(id !== undefined ? { id } : {}), code: codeOf(e), message: e instanceof Error ? e.message : String(e) });
  }
}
