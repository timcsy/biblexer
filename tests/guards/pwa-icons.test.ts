// 守護：可在手機安裝成 App（PWA）——Android 需要 192 與 512 的圖示（含 maskable），iOS 需要 apple-touch-icon。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
/** PNG 的寬高（IHDR） */
const size = (f: string) => {
  const b = readFileSync(join(ROOT, 'public/icons', f));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test('圖示檔存在且尺寸正確', () => {
  expect(size('icon-192.png')).toEqual([192, 192]);
  expect(size('icon-512.png')).toEqual([512, 512]);
  expect(size('maskable-512.png')).toEqual([512, 512]);
  expect(size('apple-touch-icon.png')).toEqual([180, 180]);
});

test('網站設定檔列出圖示（含 maskable），首頁有 iOS 的主畫面圖示', () => {
  const config = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
  for (const f of ['icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png']) expect(config).toContain(f);
  expect(config).toContain("purpose: 'maskable'");
  expect(readFileSync(join(ROOT, 'index.html'), 'utf8')).toContain('apple-touch-icon');
});
