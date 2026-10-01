// npm run bench：以固定查詢比較候選臂，輸出 bench/report.json 與 report.md（contracts/benchmark.md）
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCorpus } from '../src/core/search.ts';
import { serializeVectorStore } from '../src/core/vectors.ts';
import { MODELS_CACHE, fetchModel } from '../scripts/fetch-models.ts';
import { buildVectors, textKey } from '../scripts/build-vectors.ts';
import { PUBLIC_DIR } from '../scripts/lib/paths.ts';
import { evaluate, loadArms, loadDataset, loadQueries, makeEmbedder, type Arm } from './lib.ts';
import { SIZE_LIMIT_BYTES, buildReport, gateQueries, meanBestRank, selectArm, type ArmSummary } from './select.ts';

const T2CN_BYTES = 452 * 1024; // opencc-js t2cn gzip 後約 452 KB（research R6）

async function main() {
  const envFile = join(import.meta.dirname, '../.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const only = process.argv.includes('--arm') ? process.argv[process.argv.indexOf('--arm') + 1] : undefined;
  // 完整評測預設不跑診斷臂（大模型、遠端 API）；要跑時以 --arm 指定
  const arms = loadArms().filter((a) => (only ? a.id === only : !a.diagnostic));
  const queries = loadQueries();
  const ds = loadDataset(PUBLIC_DIR);
  const baseBytes = Object.entries(ds.manifest.files).filter(([k]) => k !== 'vectors').reduce((a, [, f]) => a + f.bytes, 0);

  const results: Array<{ armId: string; queryId: string; bestRank: number | null; firstRank: number | null }> = [];
  const summary: ArmSummary[] = [];
  const latency: Record<string, number> = {};

  for (const arm of arms) {
    console.log(`== ${arm.id}`);
    const root = arm.backend ? '' : await fetchModel(arm);
    const modelBytes = arm.files.reduce((a, f) => a + statSync(join(root, f.path)).size, 0);
    const embedder = await makeEmbedder(arm, MODELS_CACHE);
    const vectors = await buildVectors(arm, textKey(ds.manifest), ds.unitTexts, embedder);
    const corpus = buildCorpus({ ...ds.corpusParts, vectors });
    const { results: qr, latenciesMs } = await evaluate(corpus, ds.verses, embedder, queries);
    for (const r of qr) results.push({ armId: arm.id, queryId: r.queryId, bestRank: r.bestRank, firstRank: r.firstRank });
    const acc = gateQueries(qr);
    const held = qr.filter((r) => r.heldOut);
    const hit = (r: { bestRank: number | null }) => r.bestRank !== null && r.bestRank <= 5;
    summary.push({
      armId: arm.id,
      hits: acc.filter(hit).length,
      meanBestRank: Math.round(meanBestRank(acc.map((r) => r.bestRank)) * 1000) / 1000,
      heldOutHits: held.filter(hit).length,
      sizeBytes: baseBytes + modelBytes + serializeVectorStore(vectors).byteLength + (arm.toSimplified ? T2CN_BYTES : 0),
    });
    latency[arm.id] = [...latenciesMs].sort((a, b) => a - b)[Math.floor(latenciesMs.length / 2)]!;
    console.log(`   命中 ${summary.at(-1)!.hits}/${acc.length}；保留查詢 ${summary.at(-1)!.heldOutHits}/${held.length}`);
  }

  // 診斷臂（超過大小上限的大模型、遠端模型）只供參考，不參與選擇
  const deliverable = new Set(arms.filter((a) => !a.diagnostic).map((a) => a.id));
  const required = gateQueries(queries).length;
  const { selected, reason } = selectArm(summary.filter((x) => deliverable.has(x.armId)), { sizeLimitBytes: SIZE_LIMIT_BYTES, required });
  const armMeta = arms.map(({ files: _f, ...rest }) => rest);
  // 單臂模式（--arm）只做探索，輸出到 .cache/，不覆蓋正式報告
  const outDir = only ? join(import.meta.dirname, '../.cache') : import.meta.dirname;
  const prefix = only ? `bench-${only}.` : '';
  writeFileSync(join(outDir, `${prefix}report.json`), buildReport({ dataVersion: ds.manifest.dataVersion, arms: armMeta, results, summary, selected, reason }));
  writeFileSync(join(outDir, `${prefix}report.md`), renderMarkdown(arms, queries.map((q) => q.id), queries.filter((q) => q.heldOut).map((q) => q.id), results, summary, selected, reason, latency, queries.filter((q) => !q.heldOut && q.gate === false).map((q) => q.id)));
  console.log(`\n選中：${selected ?? '（無）'}——${reason}`);
}

function renderMarkdown(
  arms: Arm[],
  queryIds: string[],
  heldOut: string[],
  results: Array<{ armId: string; queryId: string; bestRank: number | null; firstRank: number | null }>,
  summary: ArmSummary[],
  selected: string | null,
  reason: string,
  latency: Record<string, number>,
  observe: string[] = [],
): string {
  const mb = (b: number) => (b / 1024 / 1024).toFixed(1);
  const cell = (armId: string, q: string) => {
    const x = results.find((y) => y.armId === armId && y.queryId === q);
    const r = x?.bestRank ?? null;
    const viaRephrase = r !== null && r !== x?.firstRank ? '換' : '';
    return r !== null && r <= 5 ? `${r}${viaRephrase}` : `✗${r === null ? '' : `(${r})`}`;
  };
  const sorted = [...arms].sort((a, b) => a.id.localeCompare(b.id));
  const gateIds = queryIds.filter((q) => !heldOut.includes(q) && !observe.includes(q));
  const head = ['臂', ...queryIds.map((q) => (heldOut.includes(q) ? `*${q}` : observe.includes(q) ? `°${q}` : q)), '命中', '平均名次', '保留命中', '下載 MB', '≤200MB', 'Node 延遲中位數 ms', '選中'];
  const rows = sorted.map((a) => {
    const s = summary.find((x) => x.armId === a.id)!;
    return [a.id, ...queryIds.map((q) => cell(a.id, q)), `${s.hits}/${gateIds.length}`, s.meanBestRank.toFixed(2), `${s.heldOutHits}/${heldOut.length}`, mb(s.sizeBytes), s.sizeBytes <= SIZE_LIMIT_BYTES ? '✓' : '✗', (latency[a.id] ?? 0).toFixed(0), a.id === selected ? '★' : ''];
  });
  return [
    '# 評測報告',
    '',
    '表格中的數字是期望經文的最佳名次（前 5 名以內才算命中；✗ 後括號為實際名次）。驗收查詢可用原句或一次換說法，「換」表示換說法後才命中。* 開頭為保留查詢、° 開頭為觀察指標（history/004），只供參考，不影響選擇。',
    'Node 延遲中位數僅供參考（SC-004 以手機實測為準），不寫入 report.json。',
    '',
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    `**選中**：${selected ?? '（無）'}——${reason}`,
    '',
  ].join('\n');
}

await main();
