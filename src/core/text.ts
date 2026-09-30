// 經文正規化（建置時與執行時共用；research R1）
//
// 和合本的括號有兩種：
// - 譯者註：（或譯…）（原文是…）（或作…）（有古卷…）與【…】——抽出為譯註。
// - 經文本身：詩篇標題、「細拉」、敘事旁白、〈…〉——保留在檢索文字中，只去掉括號。

export interface DisplayPart {
  kind: 'text' | 'note';
  value: string;
}

const NOTE_MARKERS = /^(或譯|原文|或作|有古卷)/;

/** 把顯示用經文切成正文與譯註片段；片段依序串起來等於原文 */
export function splitDisplay(display: string): DisplayPart[] {
  const parts: DisplayPart[] = [];
  const push = (kind: DisplayPart['kind'], value: string) => {
    if (!value) return;
    const last = parts.at(-1);
    if (last && kind === 'text' && last.kind === 'text') last.value += value;
    else parts.push({ kind, value });
  };

  let i = 0;
  let textStart = 0;
  while (i < display.length) {
    const c = display[i];
    if (c === '【') {
      const close = display.indexOf('】', i + 1);
      const end = close === -1 ? display.length : close + 1;
      push('text', display.slice(textStart, i));
      push('note', display.slice(i, end));
      i = textStart = end;
      continue;
    }
    if (c === '（' && NOTE_MARKERS.test(display.slice(i + 1))) {
      const close = display.indexOf('）', i + 1);
      const end = close === -1 ? display.length : close + 1;
      push('text', display.slice(textStart, i));
      push('note', display.slice(i, end));
      i = textStart = end;
      continue;
    }
    i++;
  }
  push('text', display.slice(textStart));
  return parts;
}

export function extractNotes(display: string): string[] {
  return splitDisplay(display)
    .filter((p) => p.kind === 'note')
    .map((p) => p.value);
}

const BRACKETS = /[（）〈〉【】﹝﹞]/g;
const NAME_DOTS = /[•．]/g;

/** 檢索用文字：去除譯註、括號、神版抬頭空白、連接號；統一人名間隔點 */
export function toSearchText(display: string): string {
  return splitDisplay(display)
    .filter((p) => p.kind === 'text')
    .map((p) => p.value)
    .join('')
    .replace(BRACKETS, '')
    .replace(/\u3000/g, '')
    .replace(/[─－]/g, '')
    .replace(NAME_DOTS, '‧')
    .trim();
}
