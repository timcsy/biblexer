// 串珠資料來源的解析（spec 004 FR-007、FR-008）：UBS Parallel Passages（新約引用舊約）、TSK、經節編號換算。
// 經節以 { book, chapter, verse } 表示，book 為 1～66（新教正典順序，與 USFM 書卷代碼順序相同）。

export interface Ref {
  book: number;
  chapter: number;
  verse: number;
}
export interface Range {
  start: Ref;
  end: Ref;
}

/** USFM 書卷代碼，依新教正典順序（索引＋1＝書卷編號） */
export const USFM_BOOKS = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL',
  'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
] as const;
const usfmBook = (code: string): number => {
  const i = (USFM_BOOKS as readonly string[]).indexOf(code);
  if (i < 0) throw new Error(`未知的書卷代碼：${code}`);
  return i + 1;
};

const single = (book: number, chapter: number, verse: number): Range => ({ start: { book, chapter, verse }, end: { book, chapter, verse } });

/** USFM 參照：「LUK 6:27-28,35」→ 每一段一個範圍 */
export function parseUsfmRefs(s: string): Range[] {
  const m = /^([1-3A-Z]{3}) (\d+):(.+)$/.exec(s.trim());
  if (!m) throw new Error(`無法解析的參照：${s}`);
  const book = usfmBook(m[1]!);
  const chapter = Number(m[2]);
  return m[3]!.split(',').map((part) => {
    const [a, b] = part.split('-').map((x) => Number.parseInt(x, 10));
    return { start: { book, chapter, verse: a! }, end: { book, chapter, verse: b ?? a! } };
  });
}

/** UBS Parallel Passages：只取同一組裡同時有舊約（HEB）與新約（GRK）經節者——新約明引舊約 */
export function parseUbsQuotes(xml: string): Array<{ ot: Range[]; nt: Range[] }> {
  const out: Array<{ ot: Range[]; nt: Range[] }> = [];
  for (const [, body] of xml.matchAll(/<Passage>([\s\S]*?)<\/Passage>/g)) {
    const ot: Range[] = [];
    const nt: Range[] = [];
    for (const [, lang, ref] of body!.matchAll(/<Verse (HEB|GRK)="[^"]*">([^<]+)<\/Verse>/g)) (lang === 'HEB' ? ot : nt).push(...parseUsfmRefs(ref!));
    if (ot.length && nt.length) out.push({ ot, nt });
  }
  return out;
}

/**
 * 經節編號換算：原文編號（org：舊約 BHS、新約 UBS GNT）→ 英文編號（eng，和合本與之相同，只差約 7:53）。
 * 資料為 UBS versification_json 的 eng.json：mappedVerses 為「英文 → 原文」，這裡反過來查。
 * 不在對照中的原文經節，編號不變——除非同編號的英文經節已被對照到別處（它在英文裡沒有位置，如詩篇標題）→ null。
 * （初版以「這一章出現在對照中」判斷，把出 21:24、瑪 3:1 等誤判為不存在。）
 */
export function makeOrgToEng(eng: { mappedVerses: Record<string, string> }): (r: Ref) => Ref | null {
  const parse = (s: string) => {
    const m = /^([1-3A-Z]{3}) (\d+):(\d+)[a-z]?(?:-(\d+)[a-z]?)?$/.exec(s);
    if (!m) throw new Error(`無法解析的對照：${s}`);
    const v0 = Number(m[3]);
    return { book: usfmBook(m[1]!), chapter: Number(m[2]), v0, v1: m[4] ? Number(m[4]) : v0 };
  };
  const key = (b: number, c: number, v: number) => `${b}:${c}:${v}`;
  const inverse = new Map<string, Ref | null>();
  const engMapped = new Set<string>();
  const canonical = (ref: string) => (USFM_BOOKS as readonly string[]).includes(ref.slice(0, 3));
  for (const [engS, orgS] of Object.entries(eng.mappedVerses)) {
    // 對照表也涵蓋次經（如 BAR）；本專案只用 66 卷正典
    if (!canonical(engS) || !canonical(orgS)) continue;
    const e = parse(engS);
    const o = parse(orgS);
    for (let v = e.v0; v <= e.v1; v++) engMapped.add(key(e.book, e.chapter, v));
    const n = o.v1 - o.v0;
    for (let k = 0; k <= n; k++) {
      const ev = e.v0 + Math.min(k, e.v1 - e.v0);
      // 英文第 0 節＝詩篇標題：英文編號沒有這一節
      inverse.set(key(o.book, o.chapter, o.v0 + k), ev === 0 ? null : { book: e.book, chapter: e.chapter, verse: ev });
    }
  }
  return (r) => {
    const hit = inverse.get(key(r.book, r.chapter, r.verse));
    if (hit !== undefined) return hit;
    return engMapped.has(key(r.book, r.chapter, r.verse)) ? null : r;
  };
}

/** TSK 的書卷縮寫（CrossWire TSK 模組實際用到的 66 個） */
const TSK_BOOKS: Record<string, number> = Object.fromEntries(
  [
    'Ge', 'Ex', 'Le', 'Nu', 'De', 'Jos', 'Jud', 'Ru', '1Sa', '2Sa', '1Ki', '2Ki', '1Ch', '2Ch', 'Ezr', 'Ne', 'Es', 'Job', 'Ps', 'Pr', 'Ec', 'So', 'Isa', 'Jer', 'La', 'Eze', 'Da', 'Ho', 'Joe', 'Am', 'Ob', 'Jon', 'Mic', 'Na', 'Hab', 'Zep', 'Hag', 'Zec', 'Mal',
    'Mt', 'Mr', 'Lu', 'Joh', 'Ac', 'Ro', '1Co', '2Co', 'Ga', 'Eph', 'Php', 'Col', '1Th', '2Th', '1Ti', '2Ti', 'Tit', 'Phm', 'Heb', 'Jas', '1Pe', '2Pe', '1Jo', '2Jo', '3Jo', 'Jude', 'Re',
  ].map((a, i) => [a, i + 1]),
);

/**
 * TSK 一節的內容 → 參照（依原順序）。每個 scripRef 從這一節的書與章開始：
 * 「Ge 50:20」換書、「5:3」換章、「35-39」只寫節；逗號分隔同一章的多節；「1:15-2:3」跨章。
 * 略過英文旁註（*marg:、*Gr: 等以 * 開頭者）與帶 passage 屬性的章首大綱連結；不取英文分組標題。
 */
export function parseTskRefs(html: string, at: { book: number; chapter: number }): Range[] {
  const out: Range[] = [];
  for (const [, body] of html.matchAll(/<scripRef>([\s\S]*?)<\/scripRef>/g)) {
    let book = at.book;
    let chapter = at.chapter;
    for (const raw of body!.split(';')) {
      let part = raw.trim();
      if (!part || part.startsWith('*')) continue;
      const bm = /^([1-3]?[A-Z][a-z]*)\s+(.*)$/.exec(part);
      if (bm) {
        const b = TSK_BOOKS[bm[1]!];
        if (b === undefined) continue;
        book = b;
        part = bm[2]!;
      }
      const cm = /^(\d+):(.*)$/.exec(part);
      if (cm) {
        chapter = Number(cm[1]);
        part = cm[2]!;
      }
      for (const piece of part.split(',')) {
        const m = /^\s*(\d+)(?:-(?:(\d+):)?(\d+))?\s*$/.exec(piece);
        if (!m) continue;
        const v0 = Number(m[1]);
        if (m[3] === undefined) out.push(single(book, chapter, v0));
        else if (m[2] !== undefined) {
          out.push({ start: { book, chapter, verse: v0 }, end: { book, chapter: Number(m[2]), verse: Number(m[3]) } });
          chapter = Number(m[2]);
        } else out.push({ start: { book, chapter, verse: v0 }, end: { book, chapter, verse: Number(m[3]) } });
      }
    }
  }
  return out;
}
