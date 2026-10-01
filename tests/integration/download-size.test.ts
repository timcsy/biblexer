// 守護：SC-005、plan Constraints——首次下載總量 ≤ 200 MB（需先執行 npm run build）
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test } from 'vitest';
import { SIZE_LIMIT_BYTES } from '../../bench/select.ts';

const root = join(import.meta.dirname, '../..');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const size = (f: string) => statSync(f).size;

test('首次下載總量 ≤ 200 MB（資料＋模型＋一組 ORT WASM＋app shell）', () => {
  const dist = join(root, 'dist');
  expect(existsSync(dist), '請先執行 npm run build').toBe(true);
  const manifest = JSON.parse(readFileSync(join(root, 'public/data/manifest.json'), 'utf8')) as {
    model: { id: string; files: string[] };
    files: Record<string, { bytes: number }>;
  };
  const data = Object.values(manifest.files).reduce((a, f) => a + f.bytes, 0);
  const model = manifest.model.files.reduce((a, f) => a + size(join(root, 'public/models', manifest.model.id, f)), 0);
  const ortDir = join(root, 'public/ort');
  const variant = (suffix: string) => ['mjs', 'wasm'].reduce((a, ext) => a + size(join(ortDir, `ort-wasm-simd-threaded${suffix}.${ext}`)), 0);
  const ort = Math.max(variant('.asyncify'), variant(''));
  const shell = walk(dist)
    .filter((f) => !/^(data|models|ort)\//.test(relative(dist, f)))
    .reduce((a, f) => a + size(f), 0);
  const total = data + model + ort + shell;
  console.log(`首次下載：資料 ${(data / 1e6).toFixed(1)} MB、模型 ${(model / 1e6).toFixed(1)} MB、ORT ${(ort / 1e6).toFixed(1)} MB、shell ${(shell / 1e6).toFixed(1)} MB，合計 ${(total / 1e6).toFixed(1)} MB`);
  expect(total).toBeLessThanOrEqual(SIZE_LIMIT_BYTES);
});
