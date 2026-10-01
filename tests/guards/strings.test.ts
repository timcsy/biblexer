// 守護：原則 6「標示相關，不標示權威」、原則 4「不代言」（spec FR-012、FR-014、FR-029）
import { expect, test } from 'vitest';
import { STRINGS } from '../../src/ui/strings.ts';

const all = Object.values(STRINGS).join('\n');

test('介面文字不含暗示權威或代言的字眼', () => {
  for (const w of ['最佳', '推薦', '最正確', '答案', '解釋', '建議']) expect(all).not.toContain(w);
});

test('結果區標題為「可能相關的段落」；有換說法提示', () => {
  expect(STRINGS.resultsTitle).toBe('可能相關的段落');
  expect(STRINGS.rephraseHint).toContain('換個說法');
});
