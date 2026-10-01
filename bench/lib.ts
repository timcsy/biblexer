// 評測與驗收共用：載入建置產物、建立 embedder、以產品的同一條檢索路徑跑查詢
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodePassages, decodeUnits, decodeVerses, type StoredVerse } from '../src/core/artifacts.ts';
import { deserializeKeywordIndex } from '../src/core/bm25.ts';
import { bestHitRank } from '../src/core/hit.ts';
import { parseRefString, type IndexRange } from '../src/core/refs.ts';
import { buildCorpus, search, type Corpus } from '../src/core/search.ts';
import type { Lexicon } from '../src/core/expand.ts';
import { toSearchText } from '../src/core/text.ts';
import { deserializeVectorStore, type VectorStore } from '../src/core/vectors.ts';
import { createEmbedder, loadTransformersBackend, type Embedder, type Pooling } from '../src/embed/embedder.ts';
import { loadToSimplified } from '../src/embed/simplify.ts';
import type { ExpectedHash } from '../scripts/lib/fetch.ts';
import { createRemoteEmbedder, remoteOptionsFromEnv } from './remote-embedder.ts';
import { bestOfAttempts } from './select.ts';

const ROOT = join(import.meta.dirname, '..');

export interface Arm {
  id: string;
  model: string;
  revision: string;
  dtype: 'q8';
  dim: number;
  pooling: Pooling;
  queryPrefix: string;
  passagePrefix: string;
  toSimplified: boolean;
  oversize?: boolean;
  /** 只用於診斷、不交付（例如超過大小上限的大模型） */
  diagnostic?: boolean;
  /** 遠端後端（僅診斷）：目前只支援 OpenAI 相容端點 */
  backend?: 'openai';
  files: Array<{ path: string; hash: ExpectedHash }>;
}

export interface BenchmarkQuery {
  id: string;
  text: string;
  kind: string;
  expected: Array<{ start: string; end: string }>;
  heldOut: boolean;
  /** 使用者看了第一輪結果後可能改用的說法（只有一次） */
  rephrase?: string;
}

export const loadArms = (): Arm[] => JSON.parse(readFileSync(join(ROOT, 'bench/arms.json'), 'utf8')) as Arm[];
export const loadQueries = (): BenchmarkQuery[] => JSON.parse(readFileSync(join(ROOT, 'bench/queries.json'), 'utf8')) as BenchmarkQuery[];

export interface Manifest {
  dataVersion: string;
  model?: { id: string; arm: string; files: string[] };
  files: Record<string, { path: string; bytes: number }>;
}

export interface Dataset {
  manifest: Manifest;
  verses: StoredVerse[];
  passages: IndexRange[];
  units: ReturnType<typeof decodeUnits>;
  unitTexts: string[];
  corpusParts: Omit<Parameters<typeof buildCorpus>[0], 'vectors'>;
}

export function loadDataset(publicDir: string): Dataset {
  const dataDir = join(publicDir, 'data');
  const manifest = JSON.parse(readFileSync(join(dataDir, 'manifest.json'), 'utf8')) as Manifest;
  const read = (k: string) => readFileSync(join(dataDir, manifest.files[k]!.path));
  const verses = decodeVerses(read('verses').toString('utf8'));
  const passages = decodePassages(read('passages'));
  const units = decodeUnits(read('units'));
  const corpusVerses = verses.map((v) => ({ ...v.ref, searchText: toSearchText(v.display) }));
  const unitTexts = units.map((u) => corpusVerses.slice(u.start, u.end + 1).map((v) => v.searchText).join(''));
  const keyword = deserializeKeywordIndex(new Uint8Array(read('keyword')));
  const lexicon = manifest.files.lexicon ? (JSON.parse(read('lexicon').toString('utf8')) as Lexicon) : null;
  return { manifest, verses, passages, units, unitTexts, corpusParts: { verses: corpusVerses, passages, units, keyword, lexicon } };
}

export function expectedRanges(q: BenchmarkQuery, verses: readonly StoredVerse[]): IndexRange[] {
  const index = new Map(verses.map((v, i) => [`${v.ref.book}:${v.ref.chapter}:${v.ref.verse}`, i]));
  return q.expected.map((e) => {
    const [s, t] = [parseRefString(e.start), parseRefString(e.end)];
    const si = s && index.get(`${s.book}:${s.chapter}:${s.verse}`);
    const ti = t && index.get(`${t.book}:${t.chapter}:${t.verse}`);
    if (si == null || ti == null) throw new Error(`查詢 ${q.id} 的期望經節不存在：${e.start}–${e.end}`);
    return { start: si, end: ti };
  });
}

export async function makeEmbedder(arm: Pick<Arm, 'model' | 'dtype' | 'pooling' | 'queryPrefix' | 'passagePrefix' | 'toSimplified' | 'backend'>, modelsRoot: string): Promise<Embedder> {
  if (arm.backend === 'openai') return createRemoteEmbedder(remoteOptionsFromEnv(arm.model));
  const backend = await loadTransformersBackend({ modelId: arm.model, localModelPath: modelsRoot, dtype: arm.dtype, device: 'cpu' });
  const conv = arm.toSimplified ? await loadToSimplified() : undefined;
  return createEmbedder(arm, backend, conv);
}

export interface QueryResult {
  queryId: string;
  heldOut: boolean;
  /** 原句與換說法中較佳的名次 */
  bestRank: number | null;
  /** 原句（第一次問）的名次 */
  firstRank: number | null;
}

export async function evaluate(corpus: Corpus, verses: readonly StoredVerse[], embedder: Embedder, queries: readonly BenchmarkQuery[]): Promise<{ results: QueryResult[]; latenciesMs: number[] }> {
  const results: QueryResult[] = [];
  const latenciesMs: number[] = [];
  for (const q of queries) {
    const ranks: Array<number | null> = [];
    for (const text of [q.text, ...(q.rephrase ? [q.rephrase] : [])]) {
      const t0 = performance.now();
      const [vec] = await embedder.embed([text], 'query');
      const res = search({ query: text, limit: 100 }, corpus, vec!);
      latenciesMs.push(performance.now() - t0);
      ranks.push(bestHitRank(res.results.map((r) => r.passage), expectedRanges(q, verses)));
    }
    results.push({ queryId: q.id, heldOut: q.heldOut, bestRank: bestOfAttempts(ranks), firstRank: ranks[0]! });
  }
  return { results, latenciesMs };
}

/** 驗收用：以 manifest 選定的臂、public/ 中的模型與向量評測 */
export async function evaluateManifestArm(publicDir: string): Promise<QueryResult[]> {
  const ds = loadDataset(publicDir);
  const armId = ds.manifest.model?.arm;
  if (!armId) throw new Error('manifest 尚未指定模型（先執行 npm run bench 與 write-manifest）');
  const arm = loadArms().find((a) => a.id === armId)!;
  const vectors: VectorStore = deserializeVectorStore(new Uint8Array(readFileSync(join(publicDir, 'data', ds.manifest.files.vectors!.path))));
  const corpus = buildCorpus({ ...ds.corpusParts, vectors });
  const embedder = await makeEmbedder(arm, join(publicDir, 'models'));
  return (await evaluate(corpus, ds.verses, embedder, loadQueries())).results;
}
