// 唯一允許 import @huggingface/transformers 的檔案（eslint 守護；原則 4）。
// 只使用 AutoTokenizer 與 AutoModel 做特徵擷取，不使用 pipeline、不含任何生成任務。
import { AutoModel, AutoTokenizer, env } from '@huggingface/transformers';

export type Pooling = 'cls' | 'mean' | 'last';

export interface EmbedderConfig {
  pooling: Pooling;
  /** 只加在查詢端（如 bge 的檢索指令） */
  queryPrefix: string;
  passagePrefix: string;
  /** 送進模型前把繁體轉為簡體（只影響向量，不影響顯示） */
  toSimplified: boolean;
}

export interface EncodedBatch {
  /** [batch, seq, dim] 攤平 */
  hidden: Float32Array;
  batch: number;
  seq: number;
  dim: number;
  /** [batch, seq] 攤平，1＝有效 token */
  mask: ArrayLike<number>;
}

export interface EmbedBackend {
  encode(texts: string[]): Promise<EncodedBatch>;
}

export interface Embedder {
  embed(texts: string[], kind: 'query' | 'passage'): Promise<Float32Array[]>;
}

function pool(b: EncodedBatch, pooling: Pooling): Float32Array[] {
  const out: Float32Array[] = [];
  for (let i = 0; i < b.batch; i++) {
    const v = new Float32Array(b.dim);
    if (pooling === 'cls') {
      v.set(b.hidden.subarray(i * b.seq * b.dim, i * b.seq * b.dim + b.dim));
    } else if (pooling === 'last') {
      // 最後一個有效 token（依 mask 判斷，左右補齊皆適用）
      let t = b.seq - 1;
      while (t > 0 && !b.mask[i * b.seq + t]) t--;
      const o = (i * b.seq + t) * b.dim;
      v.set(b.hidden.subarray(o, o + b.dim));
    } else {
      let n = 0;
      for (let t = 0; t < b.seq; t++) {
        if (!b.mask[i * b.seq + t]) continue;
        n++;
        const o = (i * b.seq + t) * b.dim;
        for (let d = 0; d < b.dim; d++) v[d]! += b.hidden[o + d]!;
      }
      if (n) for (let d = 0; d < b.dim; d++) v[d]! /= n;
    }
    const norm = Math.hypot(...v) || 1;
    for (let d = 0; d < b.dim; d++) v[d]! /= norm;
    out.push(v);
  }
  return out;
}

export function createEmbedder(cfg: EmbedderConfig, backend: EmbedBackend, toSimplified?: (s: string) => string): Embedder {
  if (cfg.toSimplified && !toSimplified) throw new Error('toSimplified=true 需要提供繁轉簡轉換器');
  return {
    async embed(texts, kind) {
      const prefix = kind === 'query' ? cfg.queryPrefix : cfg.passagePrefix;
      const inputs = texts.map((t) => prefix + (cfg.toSimplified ? toSimplified!(t) : t));
      return pool(await backend.encode(inputs), cfg.pooling);
    },
  };
}

export interface TransformersBackendOptions {
  modelId: string;
  /** 模型根目錄（其下為 <modelId>/config.json 等） */
  localModelPath: string;
  dtype: 'q8' | 'fp32' | 'fp16' | 'q4';
  /** 瀏覽器端 ONNX Runtime WASM 的同源路徑 */
  wasmPaths?: string | { mjs: string; wasm: string };
  /** 模型檔的快取（瀏覽器端由 BibLexer 自己的 Cache Storage 提供，避免重複儲存） */
  cache?: { match(request: string): Promise<Response | undefined>; put(request: string, response: Response): Promise<void> };
  device?: 'wasm' | 'webgpu' | 'cpu';
  maxLength?: number;
}

interface TensorLike {
  data: ArrayLike<number>;
  dims: number[];
}

/** 以本地模型檔建立特徵擷取後端；完全不連外（allowRemoteModels = false） */
export async function loadTransformersBackend(opts: TransformersBackendOptions): Promise<EmbedBackend> {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = opts.localModelPath;
  const wasm = env.backends.onnx.wasm;
  if (opts.wasmPaths && wasm) wasm.wasmPaths = opts.wasmPaths;
  // 快取由 BibLexer 統一管理（research R7），transformers.js 不再另存一份
  env.useBrowserCache = false;
  env.useWasmCache = false;
  if (opts.cache) {
    env.useCustomCache = true;
    env.customCache = opts.cache;
  }

  const tokenizer = await AutoTokenizer.from_pretrained(opts.modelId);
  const model = await AutoModel.from_pretrained(opts.modelId, {
    dtype: opts.dtype,
    ...(opts.device ? { device: opts.device } : {}),
  });
  const maxLength = opts.maxLength ?? 512;

  return {
    async encode(texts) {
      const inputs = tokenizer(texts, { padding: true, truncation: true, max_length: maxLength }) as Record<string, TensorLike>;
      const outputs = (await model(inputs)) as Record<string, TensorLike>;
      const hidden = outputs.last_hidden_state ?? outputs.token_embeddings ?? Object.values(outputs)[0]!;
      const [batch, seq, dim] = hidden.dims as [number, number, number];
      const mask = inputs.attention_mask!.data;
      return { hidden: Float32Array.from(hidden.data), batch, seq, dim, mask: Array.from(mask, Number) };
    },
  };
}
