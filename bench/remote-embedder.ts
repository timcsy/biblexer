// 診斷用遠端 embedder（OpenAI 相容的 /embeddings 端點）。
// 只在 bench/ 使用：產品端必須全離線、查詢不離開裝置，src/ 不得引用本檔。
import type { Embedder } from '../src/embed/embedder.ts';

export interface RemoteEmbedderOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  batchSize?: number;
}

interface EmbeddingsResponse {
  data: Array<{ index: number; embedding: number[] }>;
}

const normalize = (v: number[]): Float32Array => {
  const n = Math.hypot(...v) || 1;
  return Float32Array.from(v, (x) => x / n);
};

export function createRemoteEmbedder(opts: RemoteEmbedderOptions, fetchImpl: typeof fetch = fetch): Embedder {
  const url = `${opts.baseUrl.replace(/\/+$/, '')}/embeddings`;
  const batchSize = opts.batchSize ?? 256;
  return {
    async embed(texts) {
      const out: Float32Array[] = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const input = texts.slice(i, i + batchSize);
        let res: Response | undefined;
        for (let attempt = 0; attempt < 5; attempt++) {
          res = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
            body: JSON.stringify({ model: opts.model, input }),
          });
          if (res.status !== 429 && res.status < 500) break;
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        }
        if (!res!.ok) throw new Error(`遠端 embedding 請求失敗：HTTP ${res!.status}`);
        const body = (await res!.json()) as EmbeddingsResponse;
        out.push(...[...body.data].sort((a, b) => a.index - b.index).map((d) => normalize(d.embedding)));
      }
      return out;
    },
  };
}

/** 從環境變數（.env）讀取設定；金鑰只用於呼叫指定端點，不寫入任何檔案或日誌 */
export function remoteOptionsFromEnv(model: string): RemoteEmbedderOptions {
  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('需要在 .env 設定 OPENAI_BASE_URL 與 OPENAI_API_KEY');
  return { baseUrl, apiKey, model: process.env.OPENAI_EMBEDDING_MODEL ?? model };
}
