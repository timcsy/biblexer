// 模型與資料的下載（FR-019、research R7）：
// 由頁面主動串流下載並回報進度，存入有版本號的 Cache Storage；全部完成後刪除舊版本（整批替換）。
// 只下載有變的檔案：內容相同的檔案從舊版本快取直接搬過來——資料檔名帶內容雜湊（同名即同內容）；
// 模型與 ORT 檔名不帶雜湊，依 manifest 公布的雜湊（integrity）與快取時記下的雜湊比對。

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
  /** 檔名不帶雜湊的檔案（模型、ORT）的內容雜湊，依網址 */
  integrity?: Readonly<Record<string, string>>;
}

const HASH_HEADER = 'x-biblexer-hash';
/** 資料檔名中的內容雜湊（如 verses.0123456789ab.json） */
const nameHash = (url: string): string | undefined => /\.([0-9a-f]{12})\.[a-z0-9]+$/.exec(url)?.[1];

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
  const hashOf = (u: string) => nameHash(u) ?? opts.integrity?.[u];
  // 先從舊版本快取搬：內容雜湊相同的檔案不必重新下載
  const old = await Promise.all((await opts.caches.keys()).filter((k) => k.startsWith(CACHE_PREFIX) && k !== cacheNameFor(opts.version)).map((k) => opts.caches.open(k)));
  const toFetch: string[] = [];
  for (const u of missing) {
    const h = hashOf(u);
    let reused = false;
    if (h)
      for (const c of old) {
        const hit = await c.match(u);
        if (!hit || (!nameHash(u) && hit.headers.get(HASH_HEADER) !== h)) continue;
        const blob = await hit.blob();
        await cache.put(u, new Response(blob, { headers: hit.headers }));
        loaded += blob.size;
        total += blob.size;
        reused = true;
        break;
      }
    if (!reused) toFetch.push(u);
  }

  const responses: Array<[string, Response]> = [];
  for (const u of toFetch) {
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
      const h = hashOf(u);
      await cache.put(u, new Response(new Blob(chunks as BlobPart[]), { headers: { 'content-type': res.headers.get('content-type') ?? 'application/octet-stream', ...(h ? { [HASH_HEADER]: h } : {}) } }));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') throw new DownloadError('QUOTA', '儲存空間不足');
      throw e;
    }
  }
  opts.onProgress?.(Math.max(total, loaded), Math.max(total, loaded));
}

/** 整批替換：目前版本的所有檔案都下載完成後，刪除其他版本（之前不刪，後面的下載可能還要從舊版本搬檔案） */
export async function dropOtherVersions(version: string, caches: CacheStorageLike): Promise<void> {
  for (const k of await caches.keys()) if (k.startsWith(CACHE_PREFIX) && k !== cacheNameFor(version)) await caches.delete(k);
}
