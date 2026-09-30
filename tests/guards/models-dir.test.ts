// 守護：原則 4「不含任何生成模組」——public/models/ 只含 manifest 指定的那一個 embedding 模型
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test } from 'vitest';

const pub = join(import.meta.dirname, '../../public');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test('public/models 只含 manifest 指定模型的檔案', () => {
  const manifest = JSON.parse(readFileSync(join(pub, 'data/manifest.json'), 'utf8')) as { model?: { id: string; files: string[] } };
  expect(manifest.model, 'manifest 尚未指定模型（先執行評測與 write-manifest）').toBeDefined();
  const expected = manifest.model!.files.map((f) => `${manifest.model!.id}/${f}`).sort();
  const modelsDir = join(pub, 'models');
  expect(existsSync(modelsDir)).toBe(true);
  expect(walk(modelsDir).map((p) => relative(modelsDir, p)).sort()).toEqual(expected);
});
