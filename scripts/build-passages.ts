// eBible 分段邊界 → passages.bin、units.bin（research R2）
import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { encodePassages, encodeUnits, type StoredVerse } from '../src/core/artifacts.ts';
import { bookByUsfm } from '../src/core/canon.ts';
import { buildPassages, buildUnits, type Passage, type Unit } from '../src/core/passages.ts';
import { parseUsfmParagraphs } from './lib/usfm.ts';
import { writeHashed, type WrittenFile } from './lib/paths.ts';

export interface PassageBuild {
  passages: Passage[];
  units: Unit[];
  files: { passages: WrittenFile; units: WrittenFile };
}

export function buildPassageFiles(zipPath: string, verses: readonly StoredVerse[]): PassageBuild {
  const index = new Map(verses.map((v, i) => [`${v.ref.book}:${v.ref.chapter}:${v.ref.verse}`, i]));
  const starts = new Set<number>();
  let missing = 0;
  for (const [name, data] of Object.entries(unzipSync(readFileSync(zipPath)))) {
    if (!name.endsWith('.usfm')) continue;
    const parsed = parseUsfmParagraphs(strFromU8(data));
    const book = bookByUsfm(parsed.usfm);
    if (!book) continue; // 前言、附錄等非書卷檔
    for (const s of parsed.starts) {
      const i = index.get(`${book.id}:${s.chapter}:${s.verse}`);
      if (i === undefined) missing++;
      else starts.add(i);
    }
  }
  if (missing) console.warn(`警告：${missing} 個分段起點在信望愛經文中找不到對應經節`);

  const passages = buildPassages(verses.map((v) => `${v.ref.book}:${v.ref.chapter}`), starts);
  const units = buildUnits(passages);
  console.log(`段落：${passages.length}（分段起點 ${starts.size}）；檢索單元：${units.length}`);
  return {
    passages,
    units,
    files: { passages: writeHashed('passages', 'bin', encodePassages(passages)), units: writeHashed('units', 'bin', encodeUnits(units)) },
  };
}
