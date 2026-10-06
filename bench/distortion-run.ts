// 執行：npx tsx bench/distortion-run.ts
// 以建置好的羅馬書資料（public/data）計算三種排列的失真，輸出 bench/layout-distortion.{json,md}
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePassages, decodeVerses } from '../src/core/artifacts.ts';
import { layoutBook } from '../src/reader/layout.ts';
import { arrange, type Arrangement } from '../src/reader/world.ts';
import { presentVerses } from '../src/worker/present.ts';
import { measure } from './distortion.ts';

const ROMANS = 45;

function main(): void {
  const manifest = JSON.parse(readFileSync('public/data/manifest.json', 'utf8')) as { dataVersion: string; files: Record<string, { path: string }> };
  const verses = decodeVerses(readFileSync(`public/data/${manifest.files.verses!.path}`, 'utf8'));
  const passages = decodePassages(new Uint8Array(readFileSync(`public/data/${manifest.files.passages!.path}`)));
  const first = verses.findIndex((v) => v.ref.book === ROMANS);
  let last = first;
  while (verses[last + 1]?.ref.book === ROMANS) last++;
  const book = {
    book: ROMANS,
    verses: presentVerses(verses, first, last, () => true),
    paragraphStarts: passages.filter((p) => p.start >= first && p.start <= last).map((p) => p.start - first),
  };
  const base = layoutBook(book);
  const rows = (['strip', 'grid', 'chapters'] as Exclude<Arrangement, 'rows'>[]).map((a) => ({ arrangement: a, ...measure(arrange(base, a)) }));
  const result = { dataVersion: manifest.dataVersion, book: 'Romans', lines: base.lines.length, pages: base.pageCount, chapters: base.chapters.length, rows };
  writeFileSync('bench/layout-distortion.json', JSON.stringify(result, null, 2) + '\n');

  const name: Record<Exclude<Arrangement, 'rows'>, string> = { strip: '長卷', grid: '每列六頁（頁面網格）', chapters: '章節地圖' };
  const f = (x: number) => x.toFixed(3);
  const md = [
    '# 版面失真：順序距離與結構距離',
    '',
    `資料：${result.dataVersion}；羅馬書 ${result.lines} 行、${result.pages} 頁、${result.chapters} 章、${rows[0]!.paragraphs} 段（新標點和合本分段）。由 \`npx tsx bench/distortion-run.ts\` 產生；度量定義見 \`bench/distortion.ts\`。`,
    '',
    '| 排列 | Spearman（順序） | Spearman（結構） | 順序鄰居保留率 | 結構鄰居保留率 |',
    '|---|---|---|---|---|',
    ...rows.map((r) => `| ${name[r.arrangement]} | ${f(r.spearmanSeq)} | ${f(r.spearmanTree)} | ${f(r.neighborsSeq)} | ${f(r.neighborsTree)} |`),
    '',
    '- Spearman：所有段落兩兩之間，畫面上的歐氏距離與該度量的等級相關（1＝完全同序）。',
    '- 順序鄰居保留率：每段在畫面上最近的 1～2 段，是否就是閱讀順序上的前後段。',
    '- 結構鄰居保留率：每段在畫面上最近的「同章段落數 − 1」段中，有多少與它同章。',
    '',
  ].join('\n');
  writeFileSync('bench/layout-distortion.md', md);
  console.log(md);
}

main();
