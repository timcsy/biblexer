// 測試用的合成書卷：多章、長短不一的段落（不依賴建置資料）
import type { BookVerse } from '../../src/reader/layout.ts';

export function sampleBook(chapters = 5, versesPerChapter = 24): { book: number; verses: BookVerse[]; paragraphStarts: number[] } {
  const verses: BookVerse[] = [];
  const paragraphStarts: number[] = [];
  let seed = 7;
  const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  for (let c = 1; c <= chapters; c++) {
    for (let v = 1; v <= versesPerChapter; v++) {
      const n = 8 + Math.floor(rand() * 70);
      const text = Array.from({ length: n }, (_, k) => (k % 9 === 8 ? '，' : '神人愛信望義'[k % 6]!)).join('') + '。';
      if (v === 1 || rand() < 0.2) paragraphStarts.push(verses.length);
      verses.push({ ref: { book: 45, chapter: c, verse: v }, parts: [{ kind: 'text', value: text }], merged: false });
    }
  }
  return { book: 45, verses, paragraphStarts };
}
