// 守護：FR-019（下載進度）、research R7（版本化的 Cache Storage、整批替換、配額錯誤）
import { describe, expect, test, vi } from 'vitest';
import { DownloadError, cacheNameFor, downloadAll, dropOtherVersions, type CacheLike, type CacheStorageLike } from '../../src/pwa/download.ts';

function fakeCaches(): CacheStorageLike & { store: Map<string, Map<string, Response>> } {
  const store = new Map<string, Map<string, Response>>();
  const open = async (name: string): Promise<CacheLike> => {
    if (!store.has(name)) store.set(name, new Map());
    const c = store.get(name)!;
    return {
      match: async (url: string) => c.get(url)?.clone(),
      put: async (url: string, res: Response) => void c.set(url, res),
    };
  };
  return { store, open, keys: async () => [...store.keys()], delete: async (n: string) => store.delete(n) };
}

const body = (n: number) => new Uint8Array(n).fill(7);
const fetcher = () =>
  vi.fn(async (url: string) => new Response(body(url.includes('big') ? 1000 : 100), { headers: { 'content-length': url.includes('big') ? '1000' : '100' } }));

describe('下載', () => {
  test('依 Content-Length 回報整體進度，完成時 loaded = total', async () => {
    const caches = fakeCaches();
    const progress: Array<[number, number]> = [];
    await downloadAll(['/data/a.bin', '/models/big.onnx'], { version: 'v1', caches, fetchImpl: fetcher(), onProgress: (l, t) => progress.push([l, t]) });
    expect(progress.at(-1)).toEqual([1100, 1100]);
    expect(progress.every(([l, t]) => l <= t)).toBe(true);
  });

  test('存在有版本號的快取中；已快取的檔案不重新下載', async () => {
    const caches = fakeCaches();
    const f = fetcher();
    await downloadAll(['/data/a.bin'], { version: 'v1', caches, fetchImpl: f });
    await downloadAll(['/data/a.bin'], { version: 'v1', caches, fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(1);
    expect(caches.store.has(cacheNameFor('v1'))).toBe(true);
  });

  test('版本更新時下載到新快取；全部完成後才刪除舊版本快取（整批替換）', async () => {
    const caches = fakeCaches();
    await downloadAll(['/data/a.bin'], { version: 'v1', caches, fetchImpl: fetcher() });
    await downloadAll(['/data/b.bin'], { version: 'v2', caches, fetchImpl: fetcher() });
    // 下載途中舊版本還在（第二批下載可能要重用它）
    expect(await caches.keys()).toEqual([cacheNameFor('v1'), cacheNameFor('v2')]);
    await dropOtherVersions('v2', caches);
    expect(await caches.keys()).toEqual([cacheNameFor('v2')]);
  });

  test('QuotaExceededError 轉為 QUOTA 錯誤；HTTP 錯誤轉為 NETWORK', async () => {
    const caches = fakeCaches();
    const full: CacheStorageLike = {
      ...caches,
      open: async () => ({ match: async () => undefined, put: async () => { throw new DOMException('full', 'QuotaExceededError'); } }),
    };
    await expect(downloadAll(['/data/a.bin'], { version: 'v1', caches: full, fetchImpl: fetcher() })).rejects.toMatchObject({ code: 'QUOTA' });
    const bad = vi.fn(async () => new Response('x', { status: 503 }));
    await expect(downloadAll(['/data/a.bin'], { version: 'v1', caches, fetchImpl: bad })).rejects.toBeInstanceOf(DownloadError);
  });

  // 只下載有變的檔案（2026-11-01）：資料檔名帶內容雜湊，同名即同內容；模型與 ORT 依 manifest 公布的雜湊比對
  test('資料檔（檔名帶雜湊）在舊版本快取裡就直接搬過來，不重新下載', async () => {
    const caches = fakeCaches();
    const f = fetcher();
    await downloadAll(['/data/verses.0123456789ab.json', '/data/xref-tsk.aaaaaaaaaaaa.bin'], { version: 'v1', caches, fetchImpl: f });
    f.mockClear();
    await downloadAll(['/data/verses.0123456789ab.json', '/data/xref-tsk.bbbbbbbbbbbb.bin'], { version: 'v2', caches, fetchImpl: f });
    expect(f.mock.calls.map((c) => c[0])).toEqual(['/data/xref-tsk.bbbbbbbbbbbb.bin']);
    expect(await (await caches.open(cacheNameFor('v2'))).match('/data/verses.0123456789ab.json')).toBeDefined();
  });

  test('模型與 ORT（檔名不帶雜湊）：雜湊相同才搬，不同就重新下載；沒有雜湊資訊就重新下載', async () => {
    const caches = fakeCaches();
    const f = fetcher();
    const urls = ['/models/m/model.onnx', '/ort/ort.wasm', '/ort/ort.mjs'];
    await downloadAll(urls, { version: 'v1', caches, fetchImpl: f, integrity: { '/models/m/model.onnx': 'aaa', '/ort/ort.wasm': 'bbb', '/ort/ort.mjs': 'ccc' } });
    f.mockClear();
    await downloadAll(urls, { version: 'v2', caches, fetchImpl: f, integrity: { '/models/m/model.onnx': 'aaa', '/ort/ort.wasm': 'zzz' } });
    expect(f.mock.calls.map((c) => c[0])).toEqual(['/ort/ort.wasm', '/ort/ort.mjs']);
  });

  test('從舊快取搬過來的檔案也計入進度，完成時 loaded = total', async () => {
    const caches = fakeCaches();
    await downloadAll(['/data/a.0123456789ab.bin'], { version: 'v1', caches, fetchImpl: fetcher() });
    const progress: Array<[number, number]> = [];
    await downloadAll(['/data/a.0123456789ab.bin', '/models/big.onnx'], { version: 'v2', caches, fetchImpl: fetcher(), onProgress: (l, t) => progress.push([l, t]) });
    expect(progress.at(-1)).toEqual([1100, 1100]);
  });
});
