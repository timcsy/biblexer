// 守護：網站可部署在子路徑（GitHub Pages 的 /biblexer/）——同源資源不得寫死從根目錄開始的路徑，一律由 src/base.ts 的 BASE 組出。
// 2026-10-31 第一次部署時漏掉 sw.ts 的 '/index.html'，Service Worker 載入即失敗、整個網站卡在「正在載入經文」。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const SRC = join(import.meta.dirname, '../../src');
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : /\.(ts|tsx)$/.test(f) ? [join(dir, f)] : []));
const ROOTED = /['"`]\/(index\.html|sw\.js|data\/|models\/|ort\/|assets\/)/;

test('原始碼沒有寫死從根目錄開始的資源路徑', () => {
  const hits = files(SRC).flatMap((f) =>
    readFileSync(f, 'utf8')
      .split('\n')
      .map((line, i) => ({ f: f.slice(SRC.length + 1), i: i + 1, line }))
      .filter(({ line }) => ROOTED.test(line) && !line.trim().startsWith('//')),
  );
  expect(hits.map((h) => `${h.f}:${h.i}  ${h.line.trim()}`)).toEqual([]);
});
