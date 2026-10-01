// 診斷用遠端 embedder（只在 bench/，產品端不得使用：原則「全離線、查詢不離開裝置」）
import { describe, expect, test, vi } from 'vitest';
import { createRemoteEmbedder } from '../../bench/remote-embedder.ts';

const okResponse = (inputs: string[], dim = 3) =>
  new Response(
    JSON.stringify({
      // 故意倒序回傳，確認依 index 還原順序
      data: inputs.map((t, i) => ({ index: i, embedding: Array.from({ length: dim }, (_, d) => (d === 0 ? t.length : 1)) })).reverse(),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

describe('遠端 embedder（OpenAI 相容端點）', () => {
  test('POST {base}/embeddings，帶 Bearer 金鑰與模型名稱；依 index 還原順序並正規化', async () => {
    const f = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => okResponse((JSON.parse(String(init!.body)) as { input: string[] }).input));
    const e = createRemoteEmbedder({ baseUrl: 'https://example.org/v1/', apiKey: 'sk-test', model: 'text-embedding-3-small', batchSize: 2 }, f);
    const vs = await e.embed(['甲', '甲乙', '甲乙丙'], 'passage');
    expect(f).toHaveBeenCalledTimes(2);
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe('https://example.org/v1/embeddings');
    expect(new Headers(init!.headers).get('authorization')).toBe('Bearer sk-test');
    expect(JSON.parse(String(init!.body))).toEqual({ model: 'text-embedding-3-small', input: ['甲', '甲乙'] });
    expect(vs.map((v) => Math.hypot(...v))).toEqual([1, 1, 1].map((x) => expect.closeTo(x, 5)));
    expect(vs[2]![0]! / vs[2]![1]!).toBeCloseTo(3, 5);
  });

  test('查詢與經文都不加前綴', async () => {
    const f = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => okResponse((JSON.parse(String(init!.body)) as { input: string[] }).input));
    const e = createRemoteEmbedder({ baseUrl: 'https://example.org/v1', apiKey: 'k', model: 'm' }, f);
    await e.embed(['神愛世人'], 'query');
    expect((JSON.parse(String(f.mock.calls[0]![1]!.body)) as { input: string[] }).input).toEqual(['神愛世人']);
  });

  test('HTTP 錯誤時拋出錯誤，且錯誤訊息不含金鑰', async () => {
    const f = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    const e = createRemoteEmbedder({ baseUrl: 'https://example.org/v1', apiKey: 'sk-secret-123', model: 'm' }, f);
    const err = (await e.embed(['甲'], 'query').catch((x: unknown) => x)) as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/401/);
    expect(err.message).not.toContain('sk-secret-123');
  });
});
