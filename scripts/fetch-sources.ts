// 下載並核對建置所需的外部來源（contracts/data-artifacts.md）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchVerified, type ExpectedHash } from './lib/fetch.ts';
import { ROOT, SOURCES_DIR } from './lib/paths.ts';

export interface Source {
  name: string;
  url: string;
  file: string;
  hash: ExpectedHash;
  use: string;
  license: string;
}

export const SOURCES = JSON.parse(readFileSync(join(ROOT, 'scripts/sources.json'), 'utf8')) as Record<'fhl' | 'ebible', Source>;

export async function fetchSources(): Promise<Record<keyof typeof SOURCES, string>> {
  const out = {} as Record<keyof typeof SOURCES, string>;
  for (const [key, s] of Object.entries(SOURCES) as Array<[keyof typeof SOURCES, Source]>) {
    const dest = join(SOURCES_DIR, s.file);
    const { downloaded } = await fetchVerified({ url: s.url, dest, hash: s.hash });
    console.log(`${downloaded ? '已下載' : '已快取'}：${s.name}`);
    out[key] = dest;
  }
  return out;
}

if (import.meta.main) await fetchSources();
