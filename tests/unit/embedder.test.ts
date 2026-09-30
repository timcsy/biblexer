// 守護：research R3（查詢前綴、簡體臂、pooling 與正規化須與建置端一致）
import { describe, expect, test } from 'vitest';
import { createEmbedder, type EmbedBackend } from '../../src/embed/embedder.ts';

// 假模型：每個 token 的隱藏向量 = [token 位置, 字元碼 % 7, 1]
function fakeBackend(seen: string[][]): EmbedBackend {
  return {
    async encode(texts) {
      seen.push(texts);
      const seq = Math.max(...texts.map((t) => [...t].length));
      const dim = 3;
      const hidden = new Float32Array(texts.length * seq * dim);
      const mask = new Array<number>(texts.length * seq).fill(0);
      texts.forEach((t, b) => {
        [...t].forEach((ch, i) => {
          const o = (b * seq + i) * dim;
          hidden[o] = i + 1;
          hidden[o + 1] = ch.codePointAt(0)! % 7;
          hidden[o + 2] = 1;
          mask[b * seq + i] = 1;
        });
      });
      return { hidden, batch: texts.length, seq, dim, mask };
    },
  };
}

const base = { pooling: 'cls' as const, queryPrefix: '', passagePrefix: '', toSimplified: false };

describe('embedder', () => {
  test('queryPrefix 只加在查詢端', async () => {
    const seen: string[][] = [];
    const e = createEmbedder({ ...base, queryPrefix: 'Q：' }, fakeBackend(seen));
    await e.embed(['神愛世人'], 'query');
    await e.embed(['神愛世人'], 'passage');
    expect(seen).toEqual([['Q：神愛世人'], ['神愛世人']]);
  });

  test('toSimplified 只影響送進模型的文字（查詢與經文皆然）', async () => {
    const seen: string[][] = [];
    const e = createEmbedder({ ...base, toSimplified: true }, fakeBackend(seen), (s) => s.replace('愛', '爱'));
    await e.embed(['神愛世人'], 'query');
    await e.embed(['神愛世人'], 'passage');
    expect(seen).toEqual([['神爱世人'], ['神爱世人']]);
  });

  test('toSimplified=true 卻沒有轉換器時拋出錯誤', () => {
    expect(() => createEmbedder({ ...base, toSimplified: true }, fakeBackend([]))).toThrow();
  });

  test('CLS pooling 取第一個 token；mean pooling 依 mask 平均；輸出為單位向量', async () => {
    const cls = createEmbedder(base, fakeBackend([]));
    const mean = createEmbedder({ ...base, pooling: 'mean' }, fakeBackend([]));
    const [c] = await cls.embed(['甲乙丙'], 'passage');
    const [m] = await mean.embed(['甲乙丙', '甲'], 'passage');
    const norm = (v: Float32Array) => Math.hypot(...v);
    expect(norm(c!)).toBeCloseTo(1, 5);
    expect(norm(m!)).toBeCloseTo(1, 5);
    // CLS：位置分量＝1；mean：位置分量＝(1+2+3)/3＝2，兩者方向不同
    expect(c![0]! / c![2]!).toBeCloseTo(1, 5);
    expect(m![0]! / m![2]!).toBeCloseTo(2, 5);
  });
});
