// 萌典近義詞＋信望愛 Strong's 原文分組 → lexicon.json（research R9）
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import xz from 'xz-decompress';
import type { StoredVerse } from '../src/core/artifacts.ts';
import { toSearchText } from '../src/core/text.ts';
import { buildLexicon, moedictSynonyms, strongsGroups } from './lib/lexicon.ts';
import { writeHashed, type WrittenFile } from './lib/paths.ts';

async function readXzJson<T>(path: string): Promise<T> {
  const stream = new xz.XzReadableStream(new Blob([readFileSync(path)]).stream());
  return JSON.parse(await new Response(stream).text()) as T;
}

export async function buildLexiconFile(moedictPath: string, dbPath: string, verses: readonly StoredVerse[]): Promise<WrittenFile> {
  const synonyms = moedictSynonyms(await readXzJson(moedictPath));
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const rows = db.prepare('SELECT txt FROM unv').all() as unknown as Array<{ txt: string }>;
  db.close();
  const cuv = verses.map((v) => toSearchText(v.display)).join('\n');
  const lex = buildLexicon(synonyms, strongsGroups(rows), cuv);
  console.log(`詞彙表：${Object.keys(lex).length} 個詞（辭典近義詞 ${synonyms.size} 條、Strong's 分組）`);
  return writeHashed('lexicon', 'json', JSON.stringify(lex));
}
