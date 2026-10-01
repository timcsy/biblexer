// 守護：原則 4「不含任何生成模組」——產品原始碼中不得出現文字生成相關的 API 或任務
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test } from 'vitest';

const src = join(import.meta.dirname, '../../src');
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

const FORBIDDEN = /text-generation|text2text|AutoModelForCausalLM|AutoModelForSeq2SeqLM|Seq2Seq|\bpipeline\s*\(|\.generate\s*\(/;

test('src/** 不含文字生成相關的 API', () => {
  const hits = walk(src)
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8')))
    .map((f) => relative(src, f));
  expect(hits).toEqual([]);
});

test('src/** 不引用診斷用的遠端 embedder（產品必須全離線）', () => {
  const hits = walk(src)
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => /remote-embedder|api\.openai|OPENAI_/.test(readFileSync(f, 'utf8')));
  expect(hits).toEqual([]);
});
