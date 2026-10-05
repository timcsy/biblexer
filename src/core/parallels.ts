// 語意近鄰串珠（spec 004）：一段經文在整本聖經中語意上可能相關的段落。
// 語意相似度屬檢索能力，不是詮釋（衍生原則 9）；只回順序、不回分數（衍生原則 6）。
// 同一章的段落排除——它們是上下文，不是串珠（原則 5 由閱讀器本身提供）。
import type { Corpus } from './search.ts';
import { dotInt8 } from './vectors.ts';

/** 段落向量：該段所有檢索單元向量的平均（還原 int8 後正規化） */
function passageVector(corpus: Corpus, passageId: number): Float32Array | null {
  const store = corpus.vectors;
  if (!store) return null;
  const v = new Float32Array(store.dim);
  let n = 0;
  corpus.units.forEach((u, i) => {
    if (u.passageId !== passageId) return;
    const base = i * store.dim;
    const s = store.scales[i]!;
    for (let d = 0; d < store.dim; d++) v[d] = v[d]! + store.data[base + d]! * s;
    n++;
  });
  if (n === 0) return null;
  const len = Math.hypot(...v);
  if (len === 0) return null;
  for (let d = 0; d < v.length; d++) v[d] = v[d]! / len;
  return v;
}

/** 與 passageId 語意上最相近的 k 個段落 id（依相似度由高到低）；排除自身與章範圍重疊的段落 */
export function parallels(corpus: Corpus, passageId: number, k: number): number[] {
  const q = passageVector(corpus, passageId);
  if (!q || !corpus.vectors) return [];
  const scores = dotInt8(q, corpus.vectors);
  const best = new Float32Array(corpus.passages.length).fill(-Infinity);
  corpus.units.forEach((u, i) => {
    if (scores[i]! > best[u.passageId]!) best[u.passageId] = scores[i]!;
  });
  const src = corpus.passages[passageId]!;
  const lo = corpus.chapterOf[src.start]!;
  const hi = corpus.chapterOf[src.end]!;
  const overlapsChapter = (p: { start: number; end: number }) => corpus.chapterOf[p.end]! >= lo && corpus.chapterOf[p.start]! <= hi;
  return corpus.passages
    .map((p, id) => ({ id, s: best[id]!, p }))
    .filter((x) => x.id !== passageId && Number.isFinite(x.s) && !overlapsChapter(x.p))
    .sort((a, b) => b.s - a.s || a.id - b.id)
    .slice(0, k)
    .map((x) => x.id);
}
