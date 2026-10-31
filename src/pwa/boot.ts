// 開機流程（data-model「狀態轉換：應用程式載入」、FR-017～020）
import { BASE } from '../base.ts';
import { ortFiles, ortVariant } from '../embed/env.ts';
import { DownloadError, cacheNameFor, downloadAll, isComplete } from './download.ts';

export type BootState =
  | { kind: 'starting' }
  | { kind: 'downloading'; phase: 'text' | 'semantic'; loaded: number; total: number }
  | { kind: 'ready' }
  | { kind: 'need-download' }
  /** 沒有 Cache Storage（非安全來源、部分無痕模式）：連網使用，無法離線保存 */
  | { kind: 'online-only' }
  | { kind: 'error'; code: string; message: string };

interface Manifest {
  dataVersion: string;
  model?: { id: string; revision: string; files: string[] };
  files: Record<string, { path: string }>;
}

const MANIFEST_URL = `${BASE}data/manifest.json`;
// 串珠參照表（明引、TSK）與 UBS 授權全文也在第一批：不依賴語意模型，離線可用（spec 004 FR-006、FR-012、FR-013）
const TEXT_KEYS = ['books', 'verses', 'passages', 'units', 'keyword', 'lexicon', 'xrefUbs', 'xrefUbsLicense', 'xrefTsk'];

export function assetUrls(m: Manifest, variant: '.asyncify' | ''): { text: string[]; heavy: string[] } {
  const text = TEXT_KEYS.filter((k) => m.files[k]).map((k) => `${BASE}data/${m.files[k]!.path}`);
  const ort = ortFiles(variant);
  const heavy = [
    ...(m.files.vectors ? [`${BASE}data/${m.files.vectors.path}`] : []),
    ...(m.model ? m.model.files.map((f) => `${BASE}models/${m.model!.id}/${f}`) : []),
    ...(m.model ? [ort.mjs, ort.wasm] : []),
  ];
  return { text, heavy };
}

export const versionOf = (m: Manifest): string => `${m.dataVersion}-${m.model?.revision.slice(0, 8) ?? 'none'}`;

async function ensureServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  await navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE });
  await navigator.serviceWorker.ready;
  if (navigator.serviceWorker.controller) return;
  // 首次安裝：等 clientsClaim 接管頁面，之後建立的 Worker 才會經由 Service Worker 取得快取
  await new Promise<void>((resolve) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
    setTimeout(resolve, 5000);
  });
}

async function loadManifest(): Promise<{ manifest: Manifest; response: Response | null } | null> {
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    // Service Worker 離線時會由快取提供 manifest 並加上標頭：視同離線
    const offline = res.headers.get('x-biblexer-offline') === '1';
    if (res.ok) return { manifest: (await res.clone().json()) as Manifest, response: offline ? null : res };
  } catch {
    /* 離線：改讀快取 */
  }
  const cached = await caches.match(MANIFEST_URL);
  return cached ? { manifest: (await cached.json()) as Manifest, response: null } : null;
}

export interface BootCallbacks {
  onState(s: BootState): void;
  /** 建立 Worker 並載入文字資料；semantic 為 true 時一併載入語意 */
  initWorker(semantic: boolean): void;
  loadSemantic(): void;
}

export async function boot(cb: BootCallbacks): Promise<void> {
  cb.onState({ kind: 'starting' });
  // 沒有 Cache Storage：不能離線保存，但仍可連網使用——Worker 直接從網路取得資料
  if (typeof caches === 'undefined') {
    cb.onState({ kind: 'online-only' });
    cb.initWorker(true);
    return;
  }
  // Service Worker 是離線的輔助：註冊失敗（例如部署設定錯誤）時記下警告、照常繼續——資料仍由頁面下載並存進快取，
  // 只是沒有離線攔截。不能讓它卡住整個網站（2026-10-31 部署時曾因此停在「正在載入經文」）。
  try {
    await ensureServiceWorker();
  } catch (e) {
    console.warn('Service Worker 註冊失敗，改為不經 Service Worker 繼續：', e);
  }
  const loaded = await loadManifest();
  if (!loaded) {
    cb.onState({ kind: 'need-download' });
    return;
  }
  const { manifest, response } = loaded;
  const version = versionOf(manifest);
  const { text, heavy } = assetUrls(manifest, ortVariant(navigator.userAgent, 'gpu' in navigator));

  if (await isComplete([...text, ...heavy], version, caches)) {
    cb.initWorker(true);
    cb.onState({ kind: 'ready' });
    void navigator.storage?.persist?.();
    return;
  }
  if (!response) {
    // 離線且資料不完整（未下載過、下載中斷或被瀏覽器清除）
    cb.onState({ kind: 'need-download' });
    return;
  }
  try {
    await downloadAll(text, { version, caches, onProgress: (l, t) => cb.onState({ kind: 'downloading', phase: 'text', loaded: l, total: t }) });
    await (await caches.open(cacheNameFor(version))).put(MANIFEST_URL, response);
    cb.initWorker(false);
    await downloadAll(heavy, { version, caches, onProgress: (l, t) => cb.onState({ kind: 'downloading', phase: 'semantic', loaded: l, total: t }) });
    cb.loadSemantic();
    cb.onState({ kind: 'ready' });
    void navigator.storage?.persist?.();
  } catch (e) {
    cb.onState(e instanceof DownloadError ? { kind: 'error', code: e.code, message: e.message } : { kind: 'error', code: 'INTERNAL', message: String(e) });
  }
}
