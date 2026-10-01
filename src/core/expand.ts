// 查詢詞彙擴充（spec FR-027、research R9）。
// 只查建置時產生的詞彙表：辭典近義詞（教育部《重編國語辭典修訂本》）與原文同字譯法（信望愛 Strong's）。
// 不含任何主題分類或詮釋（衍生原則 9）；擴充結果完整回傳，供介面列出與署名。

/** word → [擴充詞, 來源]；來源為 'moedict' 或 'strongs:G3309' 等 */
export type Lexicon = Readonly<Record<string, ReadonlyArray<readonly [string, string]>>>;

export interface Expansion {
  word: string;
  terms: Array<{ term: string; via: string }>;
}

export const MAX_WORD_CHARS = 6;

/** 以最長匹配在查詢中找出詞表中的詞，回傳各詞的擴充（已出現在查詢中的擴充詞不重複列出） */
export function expandQuery(query: string, lexicon: Lexicon): Expansion[] {
  const chars = [...query];
  const out: Expansion[] = [];
  let i = 0;
  while (i < chars.length) {
    let matched = 0;
    for (let len = Math.min(MAX_WORD_CHARS, chars.length - i); len >= 2; len--) {
      const word = chars.slice(i, i + len).join('');
      const entry = lexicon[word];
      if (!entry) continue;
      const terms = entry.filter(([t]) => !query.includes(t)).map(([term, via]) => ({ term, via }));
      if (terms.length) out.push({ word, terms });
      matched = len;
      break;
    }
    i += matched || 1;
  }
  return out;
}
