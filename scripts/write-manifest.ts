// 依評測選中的臂：把向量與模型放進 public/，並在 manifest 寫入 model 區塊（contracts/data-artifacts.md）
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadArms, type Arm } from '../bench/lib.ts';
import { MODELS_CACHE } from './fetch-models.ts';
import { vectorCachePath } from './build-vectors.ts';
import { DATA_DIR, PUBLIC_DIR, ROOT, writeHashed, type WrittenFile } from './lib/paths.ts';

type ArmLike = Pick<Arm, 'id' | 'model' | 'revision' | 'dtype' | 'dim' | 'pooling' | 'queryPrefix' | 'passagePrefix' | 'toSimplified'> & {
  files: ReadonlyArray<{ path: string }>;
};

export interface ManifestLike {
  segmentation: { id: string };
  files: Record<string, WrittenFile>;
  [k: string]: unknown;
}

export function composeManifest<M extends ManifestLike>(prev: M, report: { selected: string | null }, arms: readonly ArmLike[], vectors: WrittenFile) {
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
  };
}

function main() {
  const manifestPath = join(DATA_DIR, 'manifest.json');
  const prev = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestLike & { dataVersion: string };
  const report = JSON.parse(readFileSync(join(ROOT, 'bench/report.json'), 'utf8')) as { selected: string | null; dataVersion: string };
  if (report.dataVersion !== prev.dataVersion) throw new Error('bench/report.json 的資料版本與目前資料不同，請重跑 npm run bench');
  const arms = loadArms();
  const arm = arms.find((a) => a.id === report.selected);
  if (!arm) throw new Error('評測沒有選出任何臂');

  const cache = vectorCachePath(arm, prev.dataVersion);
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

  writeFileSync(manifestPath, JSON.stringify(composeManifest(prev, report, arms, vectors), null, 2));
  console.log(`manifest 已指定模型 ${arm.model}（${arm.id}）`);
}

if (import.meta.main) main();
