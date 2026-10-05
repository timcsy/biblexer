// 正典 66 卷（新教正典，不含次經；見 knowledge/concepts/西敏神學院傳統是設計準則.md）
// 分類兩層：約（舊約／新約）→ 類別（spec 001 FR-015）

export type Testament = 'OT' | 'NT';
export type Category = 'law' | 'history' | 'wisdom' | 'prophets' | 'gospels' | 'epistles' | 'revelation';

export interface Book {
  /** 正典順序 1..66 */
  readonly id: number;
  /** 信望愛 engs 代碼，如 `John`、`1 Sam` */
  readonly code: string;
  /** USFM 書卷代碼，如 `JHN` */
  readonly usfm: string;
  /** 中文簡稱，如 `約` */
  readonly short: string;
  /** 中文全名，如 `約翰福音` */
  readonly name: string;
  readonly testament: Testament;
  readonly category: Category;
}

// [code, usfm, short, name]
const TABLE: ReadonlyArray<readonly [string, string, string, string]> = [
  ['Gen', 'GEN', '創', '創世記'],
  ['Ex', 'EXO', '出', '出埃及記'],
  ['Lev', 'LEV', '利', '利未記'],
  ['Num', 'NUM', '民', '民數記'],
  ['Deut', 'DEU', '申', '申命記'],
  ['Josh', 'JOS', '書', '約書亞記'],
  ['Judg', 'JDG', '士', '士師記'],
  ['Ruth', 'RUT', '得', '路得記'],
  ['1 Sam', '1SA', '撒上', '撒母耳記上'],
  ['2 Sam', '2SA', '撒下', '撒母耳記下'],
  ['1 Kin', '1KI', '王上', '列王紀上'],
  ['2 Kin', '2KI', '王下', '列王紀下'],
  ['1 Chr', '1CH', '代上', '歷代志上'],
  ['2 Chr', '2CH', '代下', '歷代志下'],
  ['Ezra', 'EZR', '拉', '以斯拉記'],
  ['Neh', 'NEH', '尼', '尼希米記'],
  ['Esth', 'EST', '斯', '以斯帖記'],
  ['Job', 'JOB', '伯', '約伯記'],
  ['Ps', 'PSA', '詩', '詩篇'],
  ['Prov', 'PRO', '箴', '箴言'],
  ['Eccl', 'ECC', '傳', '傳道書'],
  ['Song', 'SNG', '歌', '雅歌'],
  ['Is', 'ISA', '賽', '以賽亞書'],
  ['Jer', 'JER', '耶', '耶利米書'],
  ['Lam', 'LAM', '哀', '耶利米哀歌'],
  ['Ezek', 'EZK', '結', '以西結書'],
  ['Dan', 'DAN', '但', '但以理書'],
  ['Hos', 'HOS', '何', '何西阿書'],
  ['Joel', 'JOL', '珥', '約珥書'],
  ['Amos', 'AMO', '摩', '阿摩司書'],
  ['Obad', 'OBA', '俄', '俄巴底亞書'],
  ['Jon', 'JON', '拿', '約拿書'],
  ['Mic', 'MIC', '彌', '彌迦書'],
  ['Nah', 'NAM', '鴻', '那鴻書'],
  ['Hab', 'HAB', '哈', '哈巴谷書'],
  ['Zeph', 'ZEP', '番', '西番雅書'],
  ['Hag', 'HAG', '該', '哈該書'],
  ['Zech', 'ZEC', '亞', '撒迦利亞書'],
  ['Mal', 'MAL', '瑪', '瑪拉基書'],
  ['Matt', 'MAT', '太', '馬太福音'],
  ['Mark', 'MRK', '可', '馬可福音'],
  ['Luke', 'LUK', '路', '路加福音'],
  ['John', 'JHN', '約', '約翰福音'],
  ['Acts', 'ACT', '徒', '使徒行傳'],
  ['Rom', 'ROM', '羅', '羅馬書'],
  ['1 Cor', '1CO', '林前', '哥林多前書'],
  ['2 Cor', '2CO', '林後', '哥林多後書'],
  ['Gal', 'GAL', '加', '加拉太書'],
  ['Eph', 'EPH', '弗', '以弗所書'],
  ['Phil', 'PHP', '腓', '腓立比書'],
  ['Col', 'COL', '西', '歌羅西書'],
  ['1 Thess', '1TH', '帖前', '帖撒羅尼迦前書'],
  ['2 Thess', '2TH', '帖後', '帖撒羅尼迦後書'],
  ['1 Tim', '1TI', '提前', '提摩太前書'],
  ['2 Tim', '2TI', '提後', '提摩太後書'],
  ['Titus', 'TIT', '多', '提多書'],
  ['Philem', 'PHM', '門', '腓利門書'],
  ['Heb', 'HEB', '來', '希伯來書'],
  ['James', 'JAS', '雅', '雅各書'],
  ['1 Pet', '1PE', '彼前', '彼得前書'],
  ['2 Pet', '2PE', '彼後', '彼得後書'],
  ['1 John', '1JN', '約一', '約翰一書'],
  ['2 John', '2JN', '約二', '約翰二書'],
  ['3 John', '3JN', '約三', '約翰三書'],
  ['Jude', 'JUD', '猶', '猶大書'],
  ['Rev', 'REV', '啟', '啟示錄'],
];

function classify(id: number): [Testament, Category] {
  if (id <= 5) return ['OT', 'law'];
  if (id <= 17) return ['OT', 'history'];
  if (id <= 22) return ['OT', 'wisdom'];
  if (id <= 39) return ['OT', 'prophets'];
  if (id <= 43) return ['NT', 'gospels'];
  if (id === 44) return ['NT', 'history'];
  if (id <= 65) return ['NT', 'epistles'];
  return ['NT', 'revelation'];
}

export const BOOKS: readonly Book[] = TABLE.map(([code, usfm, short, name], i) => {
  const id = i + 1;
  const [testament, category] = classify(id);
  return { id, code, usfm, short, name, testament, category };
});

const byCode = new Map(BOOKS.map((b) => [b.code, b]));
const byUsfm = new Map(BOOKS.map((b) => [b.usfm, b]));

export const bookById = (id: number): Book | undefined => BOOKS[id - 1];
export const bookByCode = (code: string): Book | undefined => byCode.get(code);
export const bookByUsfm = (usfm: string): Book | undefined => byUsfm.get(usfm);

export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  law: '律法書',
  history: '歷史書',
  wisdom: '詩歌智慧書',
  prophets: '先知書',
  gospels: '福音書',
  epistles: '書信',
  revelation: '啟示',
};

export const TESTAMENT_LABELS: Readonly<Record<Testament, string>> = { OT: '舊約', NT: '新約' };

/** 各卷章數（依正典順序；新教 66 卷，共 1189 章）——正典層的雙曲全貌用；資料測試與實際經文比對 */
export const CHAPTER_COUNTS: readonly number[] = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4,
  28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
];
