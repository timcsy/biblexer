import { fc, test } from '@fast-check/vitest';
import { expect } from 'vitest';
import { tokenize } from '../../src/core/tokenize.ts';

test('unigram 與 bigram；標點與空白分隔詞段', () => {
  expect(tokenize('迦拿的婚宴')).toEqual(['迦', '拿', '的', '婚', '宴', '迦拿', '拿的', '的婚', '婚宴']);
  expect(tokenize('起初，神')).toEqual(['起', '初', '神', '起初']);
  expect(tokenize('　，。')).toEqual([]);
});

test.prop([fc.string()])('具決定性，且不含標點或空白', (s) => {
  const a = tokenize(s);
  expect(tokenize(s)).toEqual(a);
  for (const t of a) expect(t).toMatch(/^[\p{L}\p{N}]+$/u);
});
