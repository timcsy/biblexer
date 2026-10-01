// 複製附出處（FR-011）：只有經文（含和合本譯註）與出處，不含任何系統產生的文字
import type { PresentedVerse } from '../worker/present.ts';
import { STRINGS } from './strings.ts';

export function formatCopy(r: { label: string; verses: readonly PresentedVerse[] }): string {
  const text = r.verses
    .filter((v) => v.inResult && !v.merged)
    .map((v) => v.parts.map((p) => p.value).join(''))
    .join('');
  return `${text}\n——${r.label}（${STRINGS.versionName}）`;
}
