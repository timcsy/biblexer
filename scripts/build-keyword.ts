// 檢索單元文字 → keyword.bin（research R5）
import type { StoredVerse } from '../src/core/artifacts.ts';
import { buildKeywordIndex, serializeKeywordIndex } from '../src/core/bm25.ts';
import type { Unit } from '../src/core/passages.ts';
import { toSearchText } from '../src/core/text.ts';
import { writeHashed, type WrittenFile } from './lib/paths.ts';

export function unitTexts(verses: readonly StoredVerse[], units: readonly Unit[]): string[] {
  const search = verses.map((v) => toSearchText(v.display));
  return units.map((u) => search.slice(u.start, u.end + 1).join(''));
}

/** 關鍵字索引建立在單節單元上（單節單元排在最前面，文件 id 即單元 id） */
export function buildKeywordFile(verses: readonly StoredVerse[], units: readonly Unit[]): WrittenFile {
  const idx = buildKeywordIndex(unitTexts(verses, units.filter((u) => u.scale === 'verse')));
  console.log(`關鍵字索引：${idx.terms.length} 個 token`);
  return writeHashed('keyword', 'bin', serializeKeywordIndex(idx));
}
