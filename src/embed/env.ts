// 離線設定（research R7）：瀏覽器端模型與 ONNX Runtime WASM 一律從同源讀取，不連外。
import { BASE } from '../base.ts';

export const BROWSER_MODEL_PATH = `${BASE}models/`;
export const BROWSER_WASM_PATH = `${BASE}ort/`;

/**
 * ONNX Runtime WASM 變體，與 transformers.js 預設邏輯一致：
 * 預設 asyncify；Safari 26 以前且沒有 WebGPU 時用一般版。
 */
export function ortVariant(userAgent: string, webgpu: boolean): '.asyncify' | '' {
  const m = /Version\/(\d+)[.\d]* (?:Mobile\/\S+ )?Safari\//.exec(userAgent);
  const safariBelow26 = !!m && !/Chrome|Chromium|Edg\//.test(userAgent) && Number(m[1]) < 26;
  return safariBelow26 && !webgpu ? '' : '.asyncify';
}

export function ortFiles(variant: '.asyncify' | ''): { mjs: string; wasm: string } {
  return {
    mjs: `${BROWSER_WASM_PATH}ort-wasm-simd-threaded${variant}.mjs`,
    wasm: `${BROWSER_WASM_PATH}ort-wasm-simd-threaded${variant}.wasm`,
  };
}
