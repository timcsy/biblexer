import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../..');
export const CACHE_DIR = join(ROOT, '.cache');
export const SOURCES_DIR = join(CACHE_DIR, 'sources');
export const PUBLIC_DIR = join(ROOT, 'public');
export const DATA_DIR = join(PUBLIC_DIR, 'data');

export interface WrittenFile {
  path: string;
  bytes: number;
}

/** 以內容雜湊命名寫入 public/data，並移除同名前綴的舊檔 */
export function writeHashed(base: string, ext: string, content: Uint8Array | string): WrittenFile {
  mkdirSync(DATA_DIR, { recursive: true });
  const buf = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 12);
  const name = `${base}.${hash}.${ext}`;
  for (const f of readdirSync(DATA_DIR)) {
    if (f.startsWith(`${base}.`) && f.endsWith(`.${ext}`) && f !== name) rmSync(join(DATA_DIR, f));
  }
  writeFileSync(join(DATA_DIR, name), buf);
  return { path: name, bytes: buf.byteLength };
}
