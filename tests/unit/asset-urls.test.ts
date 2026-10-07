// 守護：spec 004 FR-006（串珠完全在裝置上；離線可用）——離線快取要包含串珠參照表與 UBS 授權全文
import { describe, expect, test } from 'vitest';
import { assetUrls } from '../../src/pwa/boot.ts';

describe('離線快取清單', () => {
  test('經文與串珠參照表都在第一批（不依賴語意模型）', () => {
    const m = {
      dataVersion: 'x',
      files: { books: { path: 'books.a.json' }, verses: { path: 'verses.a.json' }, xrefUbs: { path: 'xref-ubs.a.bin' }, xrefUbsLicense: { path: 'xref-ubs-license.a.md' }, xrefTsk: { path: 'xref-tsk.a.bin' } },
    };
    const { text, heavy } = assetUrls(m, '');
    expect(text).toEqual(expect.arrayContaining(['/data/books.a.json', '/data/verses.a.json', '/data/xref-ubs.a.bin', '/data/xref-ubs-license.a.md', '/data/xref-tsk.a.bin']));
    expect(heavy).toEqual([]);
  });
});
