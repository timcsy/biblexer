// 依 bench/arms.json 以固定 revision 下載模型檔並逐檔核對（contracts/data-artifacts.md）
import { join } from 'node:path';
import { fetchVerified, type ExpectedHash } from './lib/fetch.ts';
import { CACHE_DIR } from './lib/paths.ts';

export const MODELS_CACHE = join(CACHE_DIR, 'models');

export interface ModelSpec {
  id: string;
  model: string;
  revision: string;
  files: ReadonlyArray<{ path: string; hash: ExpectedHash }>;
}

export const modelFileUrl = (model: string, revision: string, path: string): string =>
  `https://huggingface.co/${model}/resolve/${revision}/${path}`;

/** 下載到 <cacheDir>/<model>/…，回傳該模型的根目錄 */
export async function fetchModel(spec: ModelSpec, opts: { cacheDir?: string; fetchImpl?: typeof fetch } = {}): Promise<string> {
  const root = join(opts.cacheDir ?? MODELS_CACHE, spec.model);
  for (const f of spec.files) {
    await fetchVerified({
      url: modelFileUrl(spec.model, spec.revision, f.path),
      dest: join(root, f.path),
      hash: f.hash,
      ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
    });
  }
  return root;
}
