// 執行：npx tsx bench/tree-embedding-run.ts
// 全本的層級（正典 → 書卷 → 章 → 段落）在三個深度上，分別嵌入平面（放射佈局）與龐加萊圓盤（Sarkar），
// 比較失真與兄弟鄰居保留率。輸出 bench/tree-embedding.{json,md}
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePassages, decodeVerses } from '../src/core/artifacts.ts';
import { distortion, poincareDistance, radialEuclidean, sarkarEmbed, type Point, type TreeNode } from './tree-embedding.ts';

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

function main(): void {
  const manifest = JSON.parse(readFileSync('public/data/manifest.json', 'utf8')) as { dataVersion: string; files: Record<string, { path: string }> };
  const verses = decodeVerses(readFileSync(`public/data/${manifest.files.verses!.path}`, 'utf8'));
  const passages = decodePassages(new Uint8Array(readFileSync(`public/data/${manifest.files.passages!.path}`)));

  // 建樹（依深度截斷）
  const build = (depth: 1 | 2 | 3) => {
    const tree: TreeNode[] = [{ parent: -1 }];
    const bookNode = new Map<number, number>();
    const chapterNode = new Map<string, number>();
    for (const v of verses) {
      if (!bookNode.has(v.ref.book)) bookNode.set(v.ref.book, tree.push({ parent: 0 }) - 1);
      const key = `${v.ref.book}:${v.ref.chapter}`;
      if (depth >= 2 && !chapterNode.has(key)) chapterNode.set(key, tree.push({ parent: bookNode.get(v.ref.book)! }) - 1);
    }
    if (depth >= 3) for (const p of passages) tree.push({ parent: chapterNode.get(`${verses[p.start]!.ref.book}:${verses[p.start]!.ref.chapter}`)! });
    return tree;
  };

  const rand = rng(20261005);
  const rows = ([1, 2, 3] as const).map((depth) => {
    const tree = build(depth);
    const d = new Int32Array(tree.length);
    for (let i = 1; i < tree.length; i++) d[i] = d[tree[i]!.parent]! + 1;
    const leaves = [...tree.keys()].filter((i) => d[i] === depth);
    const pairs: Array<[number, number]> = [];
    const N = Math.min(20000, (leaves.length * (leaves.length - 1)) / 2);
    while (pairs.length < N) {
      const a = leaves[Math.floor(rand() * leaves.length)]!;
      const b = leaves[Math.floor(rand() * leaves.length)]!;
      if (a !== b) pairs.push([a, b]);
    }
    const euc = radialEuclidean(tree);
    const eDist = (a: number, b: number) => Math.hypot(euc[a]![0] - euc[b]![0], euc[a]![1] - euc[b]![1]);
    const hyp = [2, 4, 6, 8].map((tau) => {
      const pts = sarkarEmbed(tree, tau);
      const ok = pts.every((p) => Math.hypot(p[0], p[1]) < 1 - 1e-15);
      return { tau, ok, pts, ...distortion(tree, pairs, (a, b) => poincareDistance(pts[a]!, pts[b]!)) };
    });
    // 兄弟鄰居保留率：抽 200 片葉子，在嵌入中最近的「兄弟數」片葉子裡，有多少是兄弟
    const siblings = (pts: Point[] | null, dist: (a: number, b: number) => number) => {
      let sum = 0;
      let cnt = 0;
      for (let t = 0; t < 200; t++) {
        const a = leaves[Math.floor(rand() * leaves.length)]!;
        const sib = leaves.filter((x) => x !== a && tree[x]!.parent === tree[a]!.parent);
        if (!sib.length) continue;
        const near = leaves.filter((x) => x !== a).sort((x, y) => dist(a, x) - dist(a, y)).slice(0, sib.length);
        const set = new Set(sib);
        sum += near.filter((x) => set.has(x)).length / sib.length;
        cnt++;
        void pts;
      }
      return cnt ? sum / cnt : 1;
    };
    const valid = hyp.filter((h) => h.ok);
    const best = valid.reduce((m, h) => (h.mean < m.mean ? h : m), valid[0]!);
    return {
      depth,
      nodes: tree.length,
      leaves: leaves.length,
      pairs: pairs.length,
      euclidean: { ...distortion(tree, pairs, eDist), siblings: siblings(null, eDist) },
      hyperbolic: hyp.map(({ tau, ok, mean, worst }) => ({ tau, ok, mean, worst })),
      hyperbolicBest: { tau: best.tau, mean: best.mean, worst: best.worst, siblings: siblings(best.pts, (a, b) => poincareDistance(best.pts[a]!, best.pts[b]!)) },
    };
  });

  const result = { dataVersion: manifest.dataVersion, rows };
  writeFileSync('bench/tree-embedding.json', JSON.stringify(result, null, 2) + '\n');
  const f = (x: number) => (x >= 100 ? x.toExponential(1) : x.toFixed(3));
  const name = { 1: '正典 → 書卷（66）', 2: '＋章', 3: '＋段落' } as const;
  const md = [
    '# 全本層級：平面 vs 雙曲的失真',
    '',
    `資料：${result.dataVersion}。由 \`npx tsx bench/tree-embedding-run.ts\` 產生；定義見 \`bench/tree-embedding.ts\`。每個深度隨機抽樣最深一層的節點對（固定種子），雙曲取 τ ∈ {2, 4, 6, 8} 中數值穩定且平均失真最小者。`,
    '',
    '| 層級 | 節點 | 最深層節點 | 平面：平均失真 | 平面：最差比 | 平面：兄弟鄰居 | 雙曲（τ）：平均失真 | 雙曲：最差比 | 雙曲：兄弟鄰居 |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${name[r.depth]} | ${r.nodes} | ${r.leaves} | ${f(r.euclidean.mean)} | ${f(r.euclidean.worst)} | ${f(r.euclidean.siblings)} | ${f(r.hyperbolicBest.mean)}（${r.hyperbolicBest.tau}） | ${f(r.hyperbolicBest.worst)} | ${f(r.hyperbolicBest.siblings)} |`),
    '',
    '- 平均失真：每一對「嵌入距離／樹距離」與中位數比值的平均 |ln| 差（0＝只差一個全域縮放）。',
    '- 最差比：所有比值的最大／最小（1＝完美）。',
    '- 兄弟鄰居：每個節點在嵌入中最近的「兄弟數」個節點，有多少是它的兄弟（同一卷的章、同一章的段落）。',
    '',
  ].join('\n');
  writeFileSync('bench/tree-embedding.md', md);
  console.log(md);
  console.log(JSON.stringify(rows.map((r) => ({ depth: r.depth, hyperbolic: r.hyperbolic }))));
}

main();
