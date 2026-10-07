// 檢索引擎（在 Worker 中執行）：載入建置產物、計算查詢向量、搜尋與加工結果。
// 只向同源請求 /data/、/models/、/ort/（原則：全離線、查詢不離開裝置）。
import { decodePassages, decodeUnits, decodeVerses, type StoredVerse } from '../core/artifacts.ts';
import { deserializeKeywordIndex } from '../core/bm25.ts';
import { bookById } from '../core/canon.ts';
import type { Lexicon } from '../core/expand.ts';
import { buildCorpus, search, type Corpus, type SearchRequest } from '../core/search.ts';
import { normalizeQuery } from '../core/normalize.ts';
import { toSearchText } from '../core/text.ts';
import { deserializeVectorStore } from '../core/vectors.ts';
import type { Embedder, Pooling } from '../embed/embedder.ts';
import { EngineError, type Engine, type ReadyState } from './protocol.ts';
import { resolveItem, type CardItem } from '../core/card.ts';
import { parallels } from '../core/parallels.ts';
import { decodeXrefs, xrefsForPassage, type XrefTable } from '../core/xrefs.ts';
import { formatRange } from '../core/refs.ts';
import { presentResponse, presentVerses, type BookData, type CardView, type ChapterView, type ParallelItem, type ParallelsView } from './present.ts';

export interface ModelInfo {
  id: string;
  dtype: 'q8';
  pooling: Pooling;
  queryPrefix: string;
  passagePrefix: string;
  toSimplified: boolean;
}

interface Manifest {
  model?: ModelInfo;
  files: Record<string, { path: string; bytes: number }>;
}

export interface EngineDeps {
  fetchBytes(url: string, onProgress?: (loaded: number, total: number) => void): Promise<Uint8Array>;
  loadEmbedder(model: ModelInfo): Promise<Embedder>;
  onProgress?(phase: 'text' | 'model' | 'vectors', loaded: number, total: number): void;
}

export function createEngine(deps: EngineDeps): Engine {
  let verses: StoredVerse[] = [];
  let corpus: Corpus | null = null;
  let embedder: Embedder | null = null;
  let manifest: Manifest | null = null;
  let base = '';
  let parts: Omit<Parameters<typeof buildCorpus>[0], 'vectors'> | null = null;
  const get = (key: string, phase: 'text' | 'vectors' = 'text') =>
    deps.fetchBytes(base + manifest!.files[key]!.path, (l, t) => deps.onProgress?.(phase, l, t));

  // 串珠參照表（明引、TSK）：第一次開串珠時才載入；不依賴語意模型（FR-013）
  let xrefs: Promise<{ quote: XrefTable | null; tsk: XrefTable | null }> | null = null;
  const loadXrefs = () =>
    (xrefs ??= (async () => {
      const one = async (key: string) => {
        if (!manifest?.files[key]) return null;
        const b = await get(key);
        return decodeXrefs(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
      };
      const [quote, tsk] = await Promise.all([one('xrefUbs'), one('xrefTsk')]);
      return { quote, tsk };
    })());

  const requireCorpus = () => {
    if (!corpus) throw new EngineError('NOT_DOWNLOADED', '資料尚未載入');
    return corpus;
  };

  return {
    async init(manifestUrl, onStage, semantic = true) {
      base = manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1);
      manifest = JSON.parse(new TextDecoder().decode(await deps.fetchBytes(manifestUrl))) as Manifest;
      const dec = new TextDecoder();
      const [vBytes, pBytes, uBytes, kBytes, lBytes] = await Promise.all([get('verses'), get('passages'), get('units'), get('keyword'), manifest.files.lexicon ? get('lexicon') : null]);
      verses = decodeVerses(dec.decode(vBytes));
      parts = {
        verses: verses.map((v) => ({ ...v.ref, searchText: toSearchText(v.display) })),
        passages: decodePassages(pBytes),
        units: decodeUnits(uBytes),
        keyword: deserializeKeywordIndex(kBytes),
        lexicon: lBytes ? (JSON.parse(dec.decode(lBytes)) as Lexicon) : null,
      };
      corpus = buildCorpus({ ...parts, vectors: null });
      const keywordOnly: ReadyState = { keyword: true, semantic: false };
      onStage?.(keywordOnly);
      return semantic ? this.loadSemantic() : keywordOnly;
    },

    async loadSemantic() {
      if (!manifest || !parts) throw new EngineError('NOT_DOWNLOADED', '資料尚未載入');
      if (!manifest.model || !manifest.files.vectors) return { keyword: true, semantic: false };
      const [store, emb] = await Promise.all([get('vectors', 'vectors').then((b) => deserializeVectorStore(b)), deps.loadEmbedder(manifest.model)]);
      corpus = buildCorpus({ ...parts, vectors: store });
      embedder = emb;
      return { keyword: true, semantic: true };
    },

    async search(req: SearchRequest) {
      const c = requireCorpus();
      // 繁簡與全半形統一（FR-005）；只在含簡體字時才載入轉換器
      const query = await normalizeQuery(req.query);
      const vec = embedder && /[\p{L}\p{N}]/u.test(query) ? (await embedder.embed([query], 'query'))[0]! : null;
      return presentResponse(search({ ...req, query }, c, vec), verses, req.granularity ?? 'passage');
    },

    async chapter(book, chapter): Promise<ChapterView> {
      const c = requireCorpus();
      const first = verses.findIndex((v) => v.ref.book === book && v.ref.chapter === chapter);
      if (first < 0) throw new EngineError('INTERNAL', `找不到 ${book}:${chapter}`);
      const last = c.chapterEnd[first]!;
      return {
        label: `${bookById(book)!.name} ${chapter}`,
        verses: presentVerses(verses, first, last, () => true),
        passageStarts: c.passages.filter((p) => p.start >= first && p.start <= last).map((p) => p.start - first),
      };
    },

    async parallels(book, verseIdx): Promise<ParallelsView> {
      const c = requireCorpus();
      const semanticReady = !!c.vectors;
      const model = semanticReady ? (manifest?.model?.id ?? null) : null;
      const first = verses.findIndex((v) => v.ref.book === book);
      const global = first + verseIdx;
      const pid = c.passages.findIndex((p) => p.start <= global && global <= p.end);
      if (first < 0 || pid < 0) return { semanticReady, model, items: [] };
      const p0 = c.passages[pid]!;
      const item = (tier: ParallelItem['tier'], s: number, e: number): ParallelItem => ({ tier, label: formatRange(verses[s]!.ref, verses[e]!.ref), startRef: verses[s]!.ref, endRef: verses[e]!.ref, verses: presentVerses(verses, s, e, () => true) });
      // 順序：明引 → TSK → 語意近鄰（FR-009）；參照只呈現所指的經節範圍（FR-011）
      const x = await loadXrefs();
      const items: ParallelItem[] = [];
      for (const tier of ['quote', 'tsk'] as const) {
        const t = x[tier];
        if (t) for (const [s, e] of xrefsForPassage(t, p0.start, p0.end)) items.push(item(tier, s, e));
      }
      if (semanticReady)
        for (const id of parallels(c, pid, 8)) {
          const p = c.passages[id]!;
          items.push(item('semantic', p.start, p.end));
        }
      return { semanticReady, model, items };
    },

    async card(items: CardItem[]): Promise<Array<CardView | null>> {
      const c = requireCorpus();
      return items.map((item) => {
        const r = resolveItem(item, verses, c.passages);
        if (!r) return null;
        return { start: item.start, end: item.end, label: r.label, contextLabel: r.contextLabel, verses: presentVerses(verses, r.from, r.to, (i) => i >= r.selFrom && i <= r.selTo) };
      });
    },

    async book(book): Promise<BookData> {
      const c = requireCorpus();
      const first = verses.findIndex((v) => v.ref.book === book);
      if (first < 0) throw new EngineError('INTERNAL', `找不到書卷 ${book}`);
      let last = first;
      while (verses[last + 1]?.ref.book === book) last++;
      return {
        book,
        verses: presentVerses(verses, first, last, () => true),
        paragraphStarts: c.passages.filter((p) => p.start >= first && p.start <= last).map((p) => p.start - first),
      };
    },
  };
}
