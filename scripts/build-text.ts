// 信望愛 unv → books.json、verses.json（research R1）
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { unzipSync } from 'fflate';
import { encodeVerses, type StoredVerse } from '../src/core/artifacts.ts';
import { BOOKS } from '../src/core/canon.ts';
import { parseUnvRows, type UnvRow } from './lib/fhl.ts';
import { writeHashed, type WrittenFile } from './lib/paths.ts';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TextBuild {
  verses: StoredVerse[];
  files: { books: WrittenFile; verses: WrittenFile };
}

export function buildText(zipPath: string): TextBuild {
  const entries = unzipSync(readFileSync(zipPath));
  const dbName = Object.keys(entries).find((n) => n.endsWith('.db'));
  if (!dbName) throw new Error('bible_little.zip 中找不到 .db');
  const dbPath = join(mkdtempSync(join(tmpdir(), 'biblexer-')), 'bible.db');
  writeFileSync(dbPath, entries[dbName]!);

  const db = new DatabaseSync(dbPath, { readOnly: true });
  const rows = db.prepare('SELECT engs, chap, sec, txt FROM unv ORDER BY id').all() as unknown as UnvRow[];
  db.close();

  const order = new Map(BOOKS.map((b) => [b.code, b.id]));
  rows.sort((a, b) => order.get(a.engs)! - order.get(b.engs)! || a.chap - b.chap || a.sec - b.sec);
  const verses: StoredVerse[] = parseUnvRows(rows).map((v) => ({
    ref: v.ref,
    display: v.display,
    notes: v.notes,
    merged: v.mergedInto !== undefined,
    variant: v.variant,
  }));

  const books = writeHashed('books', 'json', JSON.stringify(BOOKS));
  const versesFile = writeHashed('verses', 'json', encodeVerses(verses));
  const chapters = new Set(verses.map((v) => `${v.ref.book}:${v.ref.chapter}`)).size;
  console.log(`經文：${new Set(verses.map((v) => v.ref.book)).size} 卷、${chapters} 章、${verses.length} 節`);
  return { verses, files: { books, verses: versesFile } };
}
