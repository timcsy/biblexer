// 詞彙表建置（research R9）：辭典近義詞＋原文同字譯法，只保留和合本中實際出現的詞。
import type { Lexicon } from '../../src/core/expand.ts';

interface MoedictEntry {
  title?: string;
  heteronyms?: Array<{ definitions?: Array<{ synonyms?: string }> }>;
}

/** 萌典（教育部《重編國語辭典修訂本》）詞條 → 近義詞；只取近義關係，不改動詞條內容（CC BY-ND） */
export function moedictSynonyms(entries: readonly MoedictEntry[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const e of entries) {
    if (!e.title) continue;
    const syn: string[] = [];
    for (const h of e.heteronyms ?? []) {
      for (const d of h.definitions ?? []) {
        for (const s of (d.synonyms ?? '').split(/[,，]/)) {
          const t = s.trim();
          if (t && !syn.includes(t)) syn.push(t);
        }
      }
    }
    if (!syn.length) continue;
    const prev = out.get(e.title) ?? [];
    out.set(e.title, [...prev, ...syn.filter((s) => !prev.includes(s))]);
  }
  return out;
}

const HAN = /[一-鿿]+$/;
/** 同字組過大的通常是虛詞（如 καί），不作擴充 */
export const MAX_GROUP_SIZE = 12;

/** 從信望愛 unv 的 Strong's 標記建立「同一原文字 → 和合本譯法」分組 */
export function strongsGroups(rows: ReadonlyArray<{ txt: string }>): Map<string, string[]> {
  const spans = new Map<string, Set<string>>();
  for (const { txt } of rows) {
    for (const m of txt.matchAll(/([^<>{}]*?)(?:\{[^}]*\})?<W([GH])(\d+)>/g)) {
      const han = HAN.exec(m[1]!.replace(/<[^>]*>/g, ''))?.[0];
      if (!han || han.length < 2) continue;
      const key = `${m[2]}${m[3]}`;
      let set = spans.get(key);
      if (!set) spans.set(key, (set = new Set()));
      // 標記前的片段可能含前面的字（如「何必用思慮」），取結尾 2～4 字為候選，再由下方規則去除長片段
      for (let len = 2; len <= Math.min(4, han.length); len++) set.add(han.slice(-len));
    }
  }
  const out = new Map<string, string[]>();
  for (const [key, set] of spans) {
    const multi = [...set].filter((s) => s.length >= 2);
    // 去除包含較短片段的長片段（如「用思慮」包含「思慮」）
    const kept = multi.filter((s) => !multi.some((t) => t !== s && s.includes(t)));
    if (kept.length >= 2 && kept.length <= MAX_GROUP_SIZE) out.set(key, kept);
  }
  return out;
}

/** 合併成詞彙表：辭典一層＋原文一層，不遞迴；擴充詞必須在和合本中出現 */
export function buildLexicon(synonyms: ReadonlyMap<string, readonly string[]>, groups: ReadonlyMap<string, readonly string[]>, cuvText: string): Record<string, Array<[string, string]>> {
  const groupsOf = new Map<string, string[]>();
  for (const [key, words] of groups) for (const w of words) groupsOf.set(w, [...(groupsOf.get(w) ?? []), key]);

  const lex: Record<string, Array<[string, string]>> = {};
  const add = (word: string, term: string, via: string) => {
    if (term === word) return;
    const list = (lex[word] ??= []);
    if (!list.some(([t]) => t === term)) list.push([term, via]);
  };
  const addStrongs = (word: string, base: string) => {
    for (const key of groupsOf.get(base) ?? []) for (const g of groups.get(key)!) if (g !== base) add(word, g, `strongs:${key}`);
  };

  for (const [word, syns] of synonyms) {
    const inCuv = syns.filter((s) => s.length >= 2 && cuvText.includes(s));
    for (const s of inCuv) add(word, s, 'moedict');
    for (const s of inCuv) addStrongs(word, s);
  }
  for (const w of groupsOf.keys()) addStrongs(w, w);
  return Object.fromEntries(Object.entries(lex).filter(([, v]) => v.length)) satisfies Lexicon;
}
