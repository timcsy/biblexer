// 守護：contracts/data-artifacts.md manifest.json；原則 4（只帶一個 embedding 模型）
import { describe, expect, test } from 'vitest';
import { composeManifest } from '../../scripts/write-manifest.ts';

const prev = {
  schema: 1,
  dataVersion: 'd1',
  segmentation: { id: 'cu89-paragraphs', source: 'x' },
  files: { verses: { path: 'verses.aaa.json', bytes: 10 } },
  sources: [],
};
const arm = {
  id: 'bge-small-trad',
  model: 'Xenova/bge-small-zh-v1.5',
  revision: 'r1',
  dtype: 'q8' as const,
  dim: 512,
  pooling: 'cls' as const,
  queryPrefix: '',
  passagePrefix: '',
  toSimplified: false,
  files: [{ path: 'config.json' }, { path: 'onnx/model_quantized.onnx' }],
};

describe('composeManifest', () => {
  test('依選中的臂寫入 model 區塊與 vectors 檔，保留分段視角與其他檔案', () => {
    const m = composeManifest(prev, { selected: 'bge-small-trad' }, [arm], { path: 'vectors.bbb.bin', bytes: 99 });
    expect(m.model).toEqual({
      id: 'Xenova/bge-small-zh-v1.5',
      revision: 'r1',
      dtype: 'q8' as const,
      dim: 512,
      pooling: 'cls',
      queryPrefix: '',
      passagePrefix: '',
      toSimplified: false,
      arm: 'bge-small-trad',
      files: ['config.json', 'onnx/model_quantized.onnx'],
    });
    expect(m.files.vectors).toEqual({ path: 'vectors.bbb.bin', bytes: 99 });
    expect(m.files.verses).toEqual(prev.files.verses);
    expect(m.segmentation.id).toBe('cu89-paragraphs');
  });

  test('評測沒有選出任何臂時拋出錯誤', () => {
    expect(() => composeManifest(prev, { selected: null }, [arm], { path: 'v', bytes: 1 })).toThrow();
  });
});
