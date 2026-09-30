// 字元 unigram + bigram 斷詞（research R5）：中文不以空白分詞，
// 以連續的文字字元為詞段，詞段內取單字與相鄰兩字。

const TOKEN_CHAR = /[\p{L}\p{N}]/u;

export function tokenize(text: string): string[] {
  const runs: string[][] = [];
  let run: string[] = [];
  for (const ch of text) {
    if (TOKEN_CHAR.test(ch)) run.push(ch);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);

  const unigrams: string[] = [];
  const bigrams: string[] = [];
  for (const r of runs) {
    for (let i = 0; i < r.length; i++) {
      unigrams.push(r[i]!);
      if (i + 1 < r.length) bigrams.push(r[i]! + r[i + 1]!);
    }
  }
  return [...unigrams, ...bigrams];
}
