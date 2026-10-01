// 守護：research R7——ORT WASM 變體的選用與 transformers.js 的預設邏輯一致，且一律指向同源 /ort/
import { describe, expect, test } from 'vitest';
import { ortFiles, ortVariant } from '../../src/embed/env.ts';

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';
const SAFARI_18 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const SAFARI_26 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';

describe('ORT 變體', () => {
  test('預設 asyncify；Safari 26 以前且無 WebGPU 用一般版', () => {
    expect(ortVariant(CHROME, false)).toBe('.asyncify');
    expect(ortVariant(SAFARI_26, false)).toBe('.asyncify');
    expect(ortVariant(SAFARI_18, false)).toBe('');
    expect(ortVariant(SAFARI_18, true)).toBe('.asyncify');
  });

  test('檔案路徑一律在同源 /ort/', () => {
    expect(ortFiles('.asyncify')).toEqual({ mjs: '/ort/ort-wasm-simd-threaded.asyncify.mjs', wasm: '/ort/ort-wasm-simd-threaded.asyncify.wasm' });
    expect(ortFiles('')).toEqual({ mjs: '/ort/ort-wasm-simd-threaded.mjs', wasm: '/ort/ort-wasm-simd-threaded.wasm' });
  });
});
