// 以指定臂的模型在 Node 計算所有檢索單元的 int8 向量（research R3：建置端與瀏覽器用同一個 ONNX 檔）
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildVectorStore, deserializeVectorStore, serializeVectorStore, type VectorStore } from '../src/core/vectors.ts';
import type { Embedder } from '../src/embed/embedder.ts';
import type { Arm } from '../bench/lib.ts';
import { CACHE_DIR } from './lib/paths.ts';

export const BATCH = 32;

/** 向量只取決於：模型、revision、經文端前綴、是否轉簡體、資料版本 */
export function vectorKey(arm: Arm, dataVersion: string): string {
  return createHash('sha256')
    .update(JSON.stringify([arm.model, arm.revision, arm.dtype, arm.pooling, arm.passagePrefix, arm.toSimplified, dataVersion]))
    .digest('hex')
    .slice(0, 16);
}

export const vectorCachePath = (arm: Arm, dataVersion: string): string => join(CACHE_DIR, 'vectors', `${vectorKey(arm, dataVersion)}.bin`);

export async function buildVectors(arm: Arm, dataVersion: string, texts: readonly string[], embedder: Embedder): Promise<VectorStore> {
  const cache = vectorCachePath(arm, dataVersion);
  if (existsSync(cache)) return deserializeVectorStore(new Uint8Array(readFileSync(cache)));
  const vecs: Float32Array[] = [];
  const t0 = performance.now();
  for (let i = 0; i < texts.length; i += BATCH) {
    vecs.push(...(await embedder.embed(texts.slice(i, i + BATCH), 'passage')));
    if ((i / BATCH) % 50 === 0) {
      const done = Math.min(i + BATCH, texts.length);
      console.log(`  [${arm.id}] ${done}/${texts.length}（${((performance.now() - t0) / 1000).toFixed(0)} 秒）`);
    }
  }
  const store = buildVectorStore(vecs);
  mkdirSync(join(CACHE_DIR, 'vectors'), { recursive: true });
  writeFileSync(cache, serializeVectorStore(store));
  return store;
}
