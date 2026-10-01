// 守護：research R7（自行託管 ONNX Runtime WASM，版本須與 transformers 相依一致）
import { describe, expect, test } from 'vitest';
import { isRuntimeFile, ortSource } from '../../scripts/copy-runtime.ts';

describe('ONNX Runtime 自行託管', () => {
  test('來源版本與 @huggingface/transformers 的相依一致', () => {
    const { version, expected } = ortSource();
    expect(version).toBe(expected.replace(/^[\^~]/, ''));
  });

  test('只複製會用到的兩組 WASM：asyncify（預設）與一般版（Safari 26 以前）', () => {
    expect(isRuntimeFile('ort-wasm-simd-threaded.wasm')).toBe(true);
    expect(isRuntimeFile('ort-wasm-simd-threaded.mjs')).toBe(true);
    expect(isRuntimeFile('ort-wasm-simd-threaded.asyncify.wasm')).toBe(true);
    expect(isRuntimeFile('ort-wasm-simd-threaded.asyncify.mjs')).toBe(true);
    expect(isRuntimeFile('ort-wasm-simd-threaded.jsep.mjs')).toBe(false);
    expect(isRuntimeFile('ort-wasm-simd-threaded.jspi.wasm')).toBe(false);
    expect(isRuntimeFile('ort.min.mjs')).toBe(false);
    expect(isRuntimeFile('ort.node.min.mjs')).toBe(false);
    expect(isRuntimeFile('ort-wasm-simd-threaded.wasm.map')).toBe(false);
  });
});
