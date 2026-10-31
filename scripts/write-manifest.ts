// 依評測選中的臂：把向量與模型放進 public/，並在 manifest 寫入 model 區塊（contracts/data-artifacts.md）
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { loadArms, type Arm } from '../bench/lib.ts';
import { MODELS_CACHE } from './fetch-models.ts';
import { textKey, vectorCachePath } from './build-vectors.ts';
import { DATA_DIR, PUBLIC_DIR, ROOT, writeHashed, type WrittenFile } from './lib/paths.ts';

type ArmLike = Pick<Arm, 'id' | 'model' | 'revision' | 'dtype' | 'dim' | 'pooling' | 'queryPrefix' | 'passagePrefix' | 'toSimplified'> & {
  files: ReadonlyArray<{ path: string }>;
};

export interface ManifestLike {
  segmentation: { id: string };
  files: Record<string, WrittenFile>;
  [k: string]: unknown;
}

/** integrity：模型與 ORT 檔（檔名不帶雜湊）的內容雜湊，依相對路徑——更新時內容沒變的檔案不必重新下載 */
export function composeManifest<M extends ManifestLike>(prev: M, report: { selected: string | null }, arms: readonly ArmLike[], vectors: WrittenFile, integrity: Record<string, string> = {}) {
  if (!report.selected) throw new Error('評測沒有選出任何臂，不能寫入 manifest');
  const arm = arms.find((a) => a.id === report.selected);
  if (!arm) throw new Error(`找不到臂：${report.selected}`);
  return {
    ...prev,
    model: {
      id: arm.model,
      revision: arm.revision,
      dtype: arm.dtype,
      dim: arm.dim,
      pooling: arm.pooling,
      queryPrefix: arm.queryPrefix,
      passagePrefix: arm.passagePrefix,
      toSimplified: arm.toSimplified,
      arm: arm.id,
      files: arm.files.map((f) => f.path),
    },
    files: { ...prev.files, vectors },
    integrity,
  };
}

function main() {
  const manifestPath = join(DATA_DIR, 'manifest.json');
  const prev = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestLike & { dataVersion: string };
  // 預設讀正式報告；開發期間可指定單臂報告（如 .cache/bench-bge-small-trad.report.json）
  const reportPath = process.argv[2] ?? join(ROOT, 'bench/report.json');
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { selected: string | null; dataVersion: string };
  if (report.dataVersion !== prev.dataVersion) throw new Error('bench/report.json 的資料版本與目前資料不同，請重跑 npm run bench');
  const arms = loadArms();
  const arm = arms.find((a) => a.id === report.selected);
  if (!arm) throw new Error('評測沒有選出任何臂');

  const cache = vectorCachePath(arm, textKey(prev as unknown as { files: Record<string, { path: string }> }));
  if (!existsSync(cache)) throw new Error(`找不到向量快取 ${cache}，請重跑 npm run bench`);
  const vectors = writeHashed('vectors', 'bin', new Uint8Array(readFileSync(cache)));

  // public/models 只放選中的這一個模型（原則 4）
  const modelsDir = join(PUBLIC_DIR, 'models');
  rmSync(modelsDir, { recursive: true, force: true });
  for (const f of arm.files) {
    const dest = join(modelsDir, arm.model, f.path);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(MODELS_CACHE, arm.model, f.path), dest);
  }

  // 模型與 ORT 的內容雜湊（public/ 之下的相對路徑）
  const integrity: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else integrity[relative(PUBLIC_DIR, p).split(sep).join('/')] = createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
    }
  };
  for (const d of ['models', 'ort']) if (existsSync(join(PUBLIC_DIR, d))) walk(join(PUBLIC_DIR, d));

  writeFileSync(manifestPath, JSON.stringify(composeManifest(prev, report, arms, vectors, integrity), null, 2));
  console.log(`manifest 已指定模型 ${arm.model}（${arm.id}）`);
}

if (import.meta.main) main();
