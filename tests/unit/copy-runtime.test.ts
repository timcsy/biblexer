// 守護：research R7（自行託管 ONNX Runtime WASM，版本須與 transformers 相依一致）
import { describe, expect, test } from 'vitest';
import { isRuntimeFile, ortSource } from '../../scripts/copy-runtime.ts';

describe('ONNX Runtime 自行託管', () => {
  test('來源版本與 @huggingface/transformers 的相依一致', () => {
    const { version, expected } = ortSource();
    expect(version).toBe(expected.replace(/^[\^~]/, ''));
  });

  test('只複製 WASM 執行檔與其載入器', () => {
    expect(isRuntimeFile('ort-wasm-simd-threaded.wasm')).toBe(true);
    expect(isRuntimeFile('ort-wasm-simd-threaded.jsep.mjs')).toBe(true);
    expect(isRuntimeFile('ort.min.mjs')).toBe(false);
    expect(isRuntimeFile('ort.node.min.mjs')).toBe(false);
    expect(isRuntimeFile('ort-wasm-simd-threaded.wasm.map')).toBe(false);
  });
});
