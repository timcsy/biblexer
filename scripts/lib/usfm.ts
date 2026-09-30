// eBible USFM：只取分段邊界，不取任何文字與標題（research R2、spec FR-011a）

export interface UsfmParagraphs {
  usfm: string;
  /** 每個 \p \b \m 標記之後的第一個經節 */
  starts: Array<{ chapter: number; verse: number }>;
  /** `\v 29-30` 這類合併節 */
  mergedRanges: Array<{ chapter: number; from: number; to: number }>;
}

const PARAGRAPH_MARKERS = new Set(['p', 'b', 'm']);

export function parseUsfmParagraphs(src: string): UsfmParagraphs {
  let usfm = '';
  let chapter = 0;
  let pending = false;
  const starts: UsfmParagraphs['starts'] = [];
  const mergedRanges: UsfmParagraphs['mergedRanges'] = [];

  // 逐一掃描標記：\id XXX、\c N、\v N 或 \v N-M、以及分段標記
  const re = /\\([a-z]+\d*)\*?(?:\s+([^\s\\]+))?/g;
  for (const m of src.matchAll(re)) {
    const marker = m[1]!;
    const arg = m[2];
    if (marker === 'id' && arg) {
      usfm = arg;
    } else if (marker === 'c' && arg) {
      chapter = Number(arg);
      pending = false;
    } else if (PARAGRAPH_MARKERS.has(marker)) {
      pending = true;
    } else if (marker === 'v' && arg) {
      const [fromStr, toStr] = arg.split('-');
      const from = Number(fromStr);
      if (toStr) mergedRanges.push({ chapter, from, to: Number(toStr) });
      if (pending) {
        starts.push({ chapter, verse: from });
        pending = false;
      }
    }
  }
  return { usfm, starts, mergedRanges };
}
