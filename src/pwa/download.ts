// 模型與資料的下載（FR-019、research R7）：
// 由頁面主動串流下載並回報進度，存入有版本號的 Cache Storage；成功後刪除舊版本（整批替換）。

export interface CacheLike {
  match(url: string): Promise<Response | undefined>;
  put(url: string, res: Response): Promise<void>;
}

export interface CacheStorageLike {
  open(name: string): Promise<CacheLike>;
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}

export const CACHE_PREFIX = 'biblexer-';
export const cacheNameFor = (version: string): string => `${CACHE_PREFIX}${version}`;

export class DownloadError extends Error {
  constructor(
    readonly code: 'QUOTA' | 'NETWORK',
    message: string,
  ) {
    super(message);
  }
}

export interface DownloadOptions {
  version: string;
  caches: CacheStorageLike;
  fetchImpl?: (url: string) => Promise<Response>;
  onProgress?: (loaded: number, total: number) => void;
}

/** 檢查所有檔案是否都已在目前版本的快取中 */
export async function isComplete(urls: readonly string[], version: string, caches: CacheStorageLike): Promise<boolean> {
  const cache = await caches.open(cacheNameFor(version));
  for (const u of urls) if (!(await cache.match(u))) return false;
  return true;
}

export async function downloadAll(urls: readonly string[], opts: DownloadOptions): Promise<void> {
  const doFetch = opts.fetchImpl ?? ((u: string) => fetch(u));
  const cache = await opts.caches.open(cacheNameFor(opts.version));
  const missing: string[] = [];
  for (const u of urls) if (!(await cache.match(u))) missing.push(u);

  let loaded = 0;
  let total = 0;
  const responses: Array<[string, Response]> = [];
  for (const u of missing) {
    let res: Response;
    try {
      res = await doFetch(u);
    } catch (e) {
      throw new DownloadError('NETWORK', `下載失敗：${u}（${e instanceof Error ? e.message : String(e)}）`);
    }
    if (!res.ok) throw new DownloadError('NETWORK', `下載失敗 ${res.status}：${u}`);
    total += Number(res.headers.get('content-length') ?? 0);
    responses.push([u, res]);
  }

  for (const [u, res] of responses) {
    const chunks: Uint8Array[] = [];
    if (res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        opts.onProgress?.(loaded, Math.max(total, loaded));
      }
    }
    try {
      await cache.put(u, new Response(new Blob(chunks as BlobPart[]), { headers: { 'content-type': res.headers.get('content-type') ?? 'application/octet-stream' } }));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') throw new DownloadError('QUOTA', '儲存空間不足');
      throw e;
    }
  }
  opts.onProgress?.(Math.max(total, loaded), Math.max(total, loaded));

  // 整批替換：目前版本完整後，刪除其他版本
  for (const k of await opts.caches.keys()) if (k.startsWith(CACHE_PREFIX) && k !== cacheNameFor(opts.version)) await opts.caches.delete(k);
}
