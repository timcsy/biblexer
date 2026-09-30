// 守護：contracts/data-artifacts.md（模型以固定 revision 下載並逐檔核對）
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { fetchModel, modelFileUrl } from '../../scripts/fetch-models.ts';
import { digest } from '../../scripts/lib/fetch.ts';

const small = new TextEncoder().encode('{"a":1}');
const big = new Uint8Array([1, 2, 3, 4]);
const gitBlob = (b: Uint8Array) => createHash('sha1').update(`blob ${b.byteLength}\0`).update(b).digest('hex');

const arm = {
  id: 't',
  model: 'Org/model',
  revision: 'abc123',
  files: [
    { path: 'config.json', hash: { algo: 'git-blob-sha1' as const, value: gitBlob(small) } },
    { path: 'onnx/model_quantized.onnx', hash: { algo: 'sha256' as const, value: createHash('sha256').update(big).digest('hex') } },
  ],
};

describe('模型下載', () => {
  test('URL 使用固定 revision', () => {
    expect(modelFileUrl('Org/model', 'abc123', 'onnx/model_quantized.onnx')).toBe('https://huggingface.co/Org/model/resolve/abc123/onnx/model_quantized.onnx');
  });

  test('git-blob-sha1 雜湊與 git 的 blob 物件一致', () => {
    expect(digest('git-blob-sha1', small)).toBe(gitBlob(small));
  });

  test('逐檔下載並核對，存到 <cache>/<model>/<path>', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bl-'));
    const f = vi.fn(async (url: string | URL | Request) => new Response(String(url).endsWith('.json') ? small : big));
    const root = await fetchModel(arm, { cacheDir: dir, fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls.map((c) => String(c[0]))).toEqual(arm.files.map((x) => modelFileUrl(arm.model, arm.revision, x.path)));
    expect(readFileSync(join(root, 'onnx/model_quantized.onnx'))).toEqual(Buffer.from(big));
  });

  test('任一檔案雜湊不符即失敗', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bl-'));
    const f = vi.fn(async (_url: string | URL | Request) => new Response(big));
    await expect(fetchModel(arm, { cacheDir: dir, fetchImpl: f })).rejects.toThrow(/雜湊/);
  });
});
