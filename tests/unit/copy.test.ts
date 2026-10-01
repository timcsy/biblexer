// 守護：FR-011（複製附出處）、原則 4（不含系統產生的文字）
import { describe, expect, test } from 'vitest';
import { formatCopy } from '../../src/ui/copy.ts';

const v = (verse: number, text: string, inResult = true, merged = false) => ({
  ref: { book: 43, chapter: 2, verse },
  parts: [{ kind: 'text' as const, value: text }],
  inResult,
  merged,
});

describe('複製格式', () => {
  test('段落經文（不含前後文）加上出處與譯本', () => {
    const text = formatCopy({ label: '約翰福音 2:1–2', verses: [v(0, '前文', false), v(1, '第三日，在加利利的迦拿有娶親的筵席，'), v(2, '耶穌和他的門徒也被請去赴席。')] });
    expect(text).toBe('第三日，在加利利的迦拿有娶親的筵席，耶穌和他的門徒也被請去赴席。\n——約翰福音 2:1–2（和合本）');
  });

  test('合併節佔位不重複輸出', () => {
    expect(formatCopy({ label: '創世記 24:29–30', verses: [v(29, '利百加有一個哥哥'), v(30, '', true, true)] })).toBe('利百加有一個哥哥\n——創世記 24:29–30（和合本）');
  });
});
