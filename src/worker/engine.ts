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
import { presentResponse, presentVerses, type ChapterView } from './present.ts';

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
  };
}
