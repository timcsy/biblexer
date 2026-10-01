/// <reference lib="webworker" />
import { createEmbedder, loadTransformersBackend } from '../embed/embedder.ts';
import { BROWSER_MODEL_PATH, BROWSER_WASM_PATH } from '../embed/env.ts';
import { loadToSimplified } from '../embed/simplify.ts';
import { createEngine } from './engine.ts';
import { handleMessage, type WorkerIn, type WorkerOut } from './protocol.ts';

const post = (m: WorkerOut) => postMessage(m);

async function fetchBytes(url: string, onProgress?: (loaded: number, total: number) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`讀取失敗 ${res.status}：${url}`);
  const total = Number(res.headers.get('content-length') ?? 0);
  if (!res.body || !onProgress) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

const engine = createEngine({
  fetchBytes,
  onProgress: (phase, loaded, total) => post({ type: 'progress', phase, loaded, total }),
  async loadEmbedder(model) {
    const backend = await loadTransformersBackend({
      modelId: model.id,
      localModelPath: BROWSER_MODEL_PATH,
      wasmPaths: BROWSER_WASM_PATH,
      dtype: model.dtype,
      device: 'wasm',
    });
    return createEmbedder(model, backend, model.toSimplified ? await loadToSimplified() : undefined);
  },
});

self.onmessage = (e: MessageEvent<WorkerIn>) => void handleMessage(engine, e.data, post);
