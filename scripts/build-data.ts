// npm run build:data：下載來源 → 經文 → 段落 → 關鍵字索引 → manifest
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEGMENTATION_ID } from '../src/core/passages.ts';
import { buildKeywordFile } from './build-keyword.ts';
import { buildPassageFiles } from './build-passages.ts';
import { buildText } from './build-text.ts';
import { SOURCES, fetchSources } from './fetch-sources.ts';
import { DATA_DIR } from './lib/paths.ts';

export const MANIFEST_PATH = join(DATA_DIR, 'manifest.json');

async function main() {
  const src = await fetchSources();
  const text = buildText(src.fhl);
  const pass = buildPassageFiles(src.ebible, text.verses);
  const keyword = buildKeywordFile(text.verses, pass.units);

  const files = { ...text.files, ...pass.files, keyword };
  const dataVersion = createHash('sha256')
    .update(Object.values(files).map((f) => f.path).join('|'))
    .digest('hex')
    .slice(0, 12);

  // 保留 write-manifest 寫入的模型與向量（若資料版本相同）
  const prev = existsSync(MANIFEST_PATH) ? (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, unknown>) : null;
  const keep = prev && prev.dataVersion === dataVersion ? prev : null;
  const prevFiles = (keep?.files ?? {}) as Record<string, unknown>;

  const manifest = {
    schema: 1,
    dataVersion,
    segmentation: { id: SEGMENTATION_ID, source: SOURCES.ebible.use },
    ...(keep?.model ? { model: keep.model } : {}),
    files: { ...files, ...(prevFiles.vectors ? { vectors: prevFiles.vectors } : {}) },
    sources: Object.values(SOURCES).map((s) => ({ name: s.name, url: s.url, hash: s.hash, use: s.use, license: s.license })),
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`已寫入 ${MANIFEST_PATH}（dataVersion ${dataVersion}）`);
}

if (import.meta.main) await main();
