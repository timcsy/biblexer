// 評測的選擇規則與報告（research R3；contracts/benchmark.md）
export const MISS_RANK = 1000;
export const SIZE_LIMIT_BYTES = 200 * 1024 * 1024;
export const REQUIRED_HITS = 7;

export interface ArmSummary {
  armId: string;
  hits: number;
  meanBestRank: number;
  sizeBytes: number;
  heldOutHits?: number;
}

/** 原句＋一次換說法：取較佳的名次（衍生原則 9：查不到時由使用者換一種方式問） */
export function bestOfAttempts(ranks: ReadonlyArray<number | null>): number | null {
  const hits = ranks.filter((r): r is number => r !== null);
  return hits.length ? Math.min(...hits) : null;
}

export const meanBestRank = (ranks: ReadonlyArray<number | null>): number =>
  ranks.length ? ranks.reduce<number>((a, r) => a + (r ?? MISS_RANK), 0) / ranks.length : MISS_RANK;

export function selectArm(
  summaries: readonly ArmSummary[],
  opts: { sizeLimitBytes: number; required: number },
): { selected: string | null; reason: string } {
  const eligible = summaries
    .filter((s) => s.sizeBytes <= opts.sizeLimitBytes)
    .sort((a, b) => b.hits - a.hits || a.meanBestRank - b.meanBestRank || a.sizeBytes - b.sizeBytes || a.armId.localeCompare(b.armId));
  const best = eligible[0];
  if (!best) return { selected: null, reason: '沒有任何臂符合下載大小上限' };
  if (best.hits < opts.required) {
    return { selected: null, reason: `符合大小上限的臂最多只命中 ${best.hits} 個，未達 ${opts.required} 個` };
  }
  return { selected: best.armId, reason: `命中 ${best.hits}/${opts.required}，平均最佳名次 ${best.meanBestRank.toFixed(2)}` };
}

export interface ReportInput {
  dataVersion: string;
  arms: ReadonlyArray<{ id: string } & Record<string, unknown>>;
  results: ReadonlyArray<{ armId: string; queryId: string; bestRank: number | null }>;
  summary: readonly ArmSummary[];
  selected: string | null;
  reason?: string;
}

/** 決定性的報告 JSON：所有陣列排序後輸出，不含時間戳記 */
export function buildReport(input: ReportInput): string {
  const byId = <T extends { armId: string }>(a: T, b: T) => a.armId.localeCompare(b.armId);
  const report = {
    dataVersion: input.dataVersion,
    arms: [...input.arms].sort((a, b) => a.id.localeCompare(b.id)),
    results: [...input.results]
      .sort((a, b) => a.armId.localeCompare(b.armId) || a.queryId.localeCompare(b.queryId))
      .map((r) => ({ ...r, hitAtTop5: r.bestRank !== null && r.bestRank <= 5 })),
    summary: [...input.summary].sort(byId),
    selected: input.selected,
    ...(input.reason ? { reason: input.reason } : {}),
  };
  return JSON.stringify(report, null, 2) + '\n';
}
