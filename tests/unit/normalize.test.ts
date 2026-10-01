// 守護：FR-005（繁簡輸入相同處理）、research R6（只在含簡體字時才載入轉換器）
import { describe, expect, test, vi } from 'vitest';
import { hasSimplified, normalizeQuery } from '../../src/core/normalize.ts';

describe('查詢正規化', () => {
  test('偵測簡體字', () => {
    expect(hasSimplified('麦基洗德')).toBe(true);
    expect(hasSimplified('麥基洗德')).toBe(false);
    expect(hasSimplified('神爱世人')).toBe(true);
  });

  test('含簡體字時以轉換器逐字轉為繁體', async () => {
    const loader = vi.fn(async () => (s: string) => s.replace('麦', '麥'));
    expect(await normalizeQuery('麦基洗德', loader)).toBe('麥基洗德');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('不含簡體字時不載入轉換器', async () => {
    const loader = vi.fn(async () => (s: string) => s);
    expect(await normalizeQuery('麥基洗德', loader)).toBe('麥基洗德');
    expect(loader).not.toHaveBeenCalled();
  });

  test('全形英數與標點統一為半形；去除前後空白', async () => {
    expect(await normalizeQuery('  羅８：２８  ', async () => (s) => s)).toBe('羅8:28');
  });

  test('實際的 opencc 轉換：麦基洗德 → 麥基洗德', async () => {
    expect(await normalizeQuery('麦基洗德')).toBe('麥基洗德');
  });
});
