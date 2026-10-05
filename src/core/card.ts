// 經文卡（spec 003）：使用者收集的一組經文位置。只存位置、不存經文文字（data-model）；
// 顯示時由離線資料取出所在段落（原則 5：上下文優先）。順序完全由使用者決定（原則 6）。
import type { StoredVerse } from './artifacts.ts';
import { formatRange } from './refs.ts';

export type VerseKey = [book: number, chapter: number, verse: number];

export interface CardItem {
  start: VerseKey;
  end: VerseKey;
}

export interface Card {
  version: 1;
  items: CardItem[];
}

export const EMPTY_CARD: Card = Object.freeze({ version: 1, items: [] }) as unknown as Card;

const same = (a: VerseKey, b: VerseKey) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const cmp = (a: VerseKey, b: VerseKey) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export const hasItem = (card: Card, item: CardItem): boolean => card.items.some((x) => same(x.start, item.start) && same(x.end, item.end));

export const addItem = (card: Card, item: CardItem): Card => (hasItem(card, item) ? card : { version: 1, items: [...card.items, item] });

export function moveItem(card: Card, index: number, dir: -1 | 1): Card {
  const j = index + dir;
  if (index < 0 || index >= card.items.length || j < 0 || j >= card.items.length) return card;
  const items = [...card.items];
  [items[index], items[j]] = [items[j]!, items[index]!];
  return { version: 1, items };
}

export const removeItem = (card: Card, index: number): Card => (index < 0 || index >= card.items.length ? card : { version: 1, items: card.items.filter((_, i) => i !== index) });

export const serializeCard = (card: Card): string => JSON.stringify({ version: 1, items: card.items });

const isKey = (k: unknown): k is VerseKey =>
  Array.isArray(k) && k.length === 3 && k.every((n) => Number.isInteger(n) && (n as number) >= 1) && (k[0] as number) <= 66;

/** 不合法的內容一律視為空卡（儲存可能被清除或損壞），不拋例外 */
export function deserializeCard(json: string | null): Card {
  try {
    const raw = JSON.parse(json ?? '') as { version?: unknown; items?: unknown };
    if (raw.version !== 1 || !Array.isArray(raw.items)) return EMPTY_CARD;
    const items: CardItem[] = [];
    for (const x of raw.items as Array<{ start?: unknown; end?: unknown }>) {
      if (!isKey(x.start) || !isKey(x.end) || cmp(x.start, x.end) > 0) return EMPTY_CARD;
      items.push({ start: [...x.start], end: [...x.end] });
    }
    return { version: 1, items };
  } catch {
    return EMPTY_CARD;
  }
}

/** 段落解析的結果：經節索引範圍與標籤（呈現由 Worker 端完成） */
export interface ResolvedRange {
  /** 所選範圍的出處，如「羅馬書 8:28」 */
  label: string;
  /** 所在段落的範圍，如「8:28–30」；與所選範圍相同時為 null */
  contextLabel: string | null;
  /** 段落範圍（全書經節索引） */
  from: number;
  to: number;
  /** 所選範圍 */
  selFrom: number;
  selTo: number;
}

const shortRange = (a: StoredVerse['ref'], b: StoredVerse['ref']) =>
  a.chapter === b.chapter ? (a.verse === b.verse ? `${a.chapter}:${a.verse}` : `${a.chapter}:${a.verse}–${b.verse}`) : `${a.chapter}:${a.verse}–${b.chapter}:${b.verse}`;

/** 把經文位置展開為所在段落（跨多段時取涵蓋起訖節的連續段落）；找不到的經節回傳 null */
export function resolveItem(item: CardItem, verses: readonly StoredVerse[], passages: ReadonlyArray<{ start: number; end: number }>): ResolvedRange | null {
  const find = (k: VerseKey) => verses.findIndex((v) => v.ref.book === k[0] && v.ref.chapter === k[1] && v.ref.verse === k[2]);
  const selFrom = find(item.start);
  let selTo = find(item.end);
  if (selFrom < 0 || selTo < 0 || selTo < selFrom) return null;
  // 合併節：承載節的內容包含其後的佔位節（和合本「29–30」）
  while (verses[selTo + 1]?.merged) selTo++;
  const first = passages.find((p) => p.start <= selFrom && selFrom <= p.end);
  const last = passages.find((p) => p.start <= selTo && selTo <= p.end);
  const from = first?.start ?? selFrom;
  const to = last?.end ?? selTo;
  return {
    label: formatRange(verses[selFrom]!.ref, verses[selTo]!.ref),
    contextLabel: from === selFrom && to === selTo ? null : shortRange(verses[from]!.ref, verses[to]!.ref),
    from,
    to,
    selFrom,
    selTo,
  };
}
