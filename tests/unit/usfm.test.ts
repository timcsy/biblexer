// 守護：research R2（只取分段邊界）、FR-011a（不取標題）
import { describe, expect, test } from 'vitest';
import { parseUsfmParagraphs } from '../../scripts/lib/usfm.ts';

const sample = String.raw`\id JHN Chinese
\h 约翰福音
\c 1
\s1 道成肉身
\p
\v 1 太初有道，
\v 2 这道太初与　神同在。
\p
\v 3 万物是借着他造的；
\s1 施洗约翰的见证
\r （太3·1—12）
\p
\v 4 生命在他里头，
\q1
\v 5 光照在黑暗里，
\b
\q1
\v 6 有一个人，
\c 2
\m
\v 1 第三日，
\v 2-3 耶稣和他的门徒
\p \v 4 酒用尽了`;

describe('USFM 分段解析', () => {
  test('書卷代碼', () => {
    expect(parseUsfmParagraphs(sample).usfm).toBe('JHN');
  });

  test('\\p \\b \\m 對應到其後第一個經節；\\q1 不是分段', () => {
    expect(parseUsfmParagraphs(sample).starts).toEqual([
      { chapter: 1, verse: 1 },
      { chapter: 1, verse: 3 },
      { chapter: 1, verse: 4 },
      { chapter: 1, verse: 6 },
      { chapter: 2, verse: 1 },
      { chapter: 2, verse: 4 },
    ]);
  });

  test('合併節 \\v 2-3 記為範圍', () => {
    expect(parseUsfmParagraphs(sample).mergedRanges).toEqual([{ chapter: 2, from: 2, to: 3 }]);
  });

  test('輸出中不含任何標題文字', () => {
    const json = JSON.stringify(parseUsfmParagraphs(sample));
    expect(json).not.toContain('道成肉身');
    expect(json).not.toContain('施洗约翰的见证');
  });
});
