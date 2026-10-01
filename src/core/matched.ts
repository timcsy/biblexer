// 命中字詞（spec FR-006）：只標示查詢（與詞彙擴充）中實際出現在經文的字詞

export const MIN_TERM = 2;

/** 查詢中出現在文字裡的最長子字串（至少兩字，不重疊），加上出現在文字裡的擴充詞 */
export function findMatchedTerms(query: string, text: string, extra: readonly string[] = []): string[] {
  const q = [...query];
  const found: string[] = [];
  let i = 0;
  while (i < q.length) {
    let len = 0;
    for (let l = q.length - i; l >= MIN_TERM; l--) {
      if (text.includes(q.slice(i, i + l).join(''))) {
        len = l;
        break;
      }
    }
    if (len) {
      const t = q.slice(i, i + len).join('');
      if (!found.includes(t)) found.push(t);
      i += len;
    } else i++;
  }
  for (const t of extra) if (!found.includes(t) && text.includes(t)) found.push(t);
  return found;
}

export interface Highlighted {
  text: string;
  mark: boolean;
}

/** 依命中字詞把文字切段；片段串起來等於原文，不切斷字元 */
export function highlight(text: string, terms: readonly string[]): Highlighted[] {
  const sorted = [...terms].filter(Boolean).sort((a, b) => b.length - a.length);
  const out: Highlighted[] = [];
  let i = 0;
  let plain = '';
  while (i < text.length) {
    const t = sorted.find((x) => text.startsWith(x, i));
    if (t) {
      if (plain) out.push({ text: plain, mark: false });
      out.push({ text: t, mark: true });
      plain = '';
      i += t.length;
    } else {
      const cp = text.codePointAt(i)!;
      const ch = String.fromCodePoint(cp);
      plain += ch;
      i += ch.length;
    }
  }
  if (plain) out.push({ text: plain, mark: false });
  return out;
}
