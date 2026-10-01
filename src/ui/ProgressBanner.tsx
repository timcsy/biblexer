import type { BootState } from '../pwa/boot.ts';
import { STRINGS } from './strings.ts';

const mb = (b: number) => (b / 1024 / 1024).toFixed(1);

// 載入狀態（FR-019）：下載進度、已可離線使用、需要先連網下載、下載失敗
export function ProgressBanner({ state }: { state: BootState }) {
  if (state.kind === 'downloading') {
    const pct = state.total ? Math.round((state.loaded / state.total) * 100) : 0;
    return (
      <div class="banner" data-testid="download-progress" role="status">
        <span>
          {state.phase === 'text' ? STRINGS.downloadingText : STRINGS.downloadingSemantic} {mb(state.loaded)} / {mb(state.total)} MB
        </span>
        <progress max={100} value={pct} />
      </div>
    );
  }
  if (state.kind === 'ready')
    return (
      <div class="banner ok" data-testid="offline-ready" role="status">
        {STRINGS.offlineReady}
        <small>{STRINGS.installHint}</small>
      </div>
    );
  if (state.kind === 'need-download')
    return (
      <div class="banner warn" data-testid="need-download" role="alert">
        {STRINGS.needDownload}
      </div>
    );
  if (state.kind === 'error')
    return (
      <div class="banner warn" data-testid="download-error" role="alert">
        {state.code === 'QUOTA' ? STRINGS.quotaError : STRINGS.downloadError}
      </div>
    );
  return null;
}
