// 自行託管 ONNX Runtime 的 WASM（research R7：transformers.js 預設從 jsdelivr 下載，會破壞離線與隱私）
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_DIR, ROOT } from './lib/paths.ts';

export const ORT_DIR = join(PUBLIC_DIR, 'ort');

export function ortSource(): { dir: string; version: string; expected: string } {
  const dir = join(ROOT, 'node_modules/onnxruntime-web');
  const version = (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { version: string }).version;
  const expected = (JSON.parse(readFileSync(join(ROOT, 'node_modules/@huggingface/transformers/package.json'), 'utf8')) as { dependencies: Record<string, string> }).dependencies['onnxruntime-web']!;
  return { dir: join(dir, 'dist'), version, expected };
}

/** 只複製會用到的兩組：asyncify（預設）與一般版（Safari 26 以前），見 src/embed/env.ts 的 ortVariant */
export const isRuntimeFile = (f: string): boolean => /^ort-wasm-simd-threaded(\.asyncify)?\.(wasm|mjs)$/.test(f);

export function copyRuntime(): string[] {
  const { dir, version, expected } = ortSource();
  if (version !== expected.replace(/^[\^~]/, '')) throw new Error(`onnxruntime-web 版本 ${version} 與 transformers 相依 ${expected} 不一致`);
  rmSync(ORT_DIR, { recursive: true, force: true });
  mkdirSync(ORT_DIR, { recursive: true });
  const files = readdirSync(dir).filter(isRuntimeFile);
  for (const f of files) cpSync(join(dir, f), join(ORT_DIR, f));
  return files;
}

if (import.meta.main) console.log('已複製 ONNX Runtime：', copyRuntime().join(', '));
