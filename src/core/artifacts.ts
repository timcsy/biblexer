// 資料產物讀寫（contracts/data-artifacts.md）
import type { VerseRef } from './refs.ts';

export const VERSE_FLAG_MERGED = 1;
export const VERSE_FLAG_VARIANT = 2;

export interface StoredVerse {
  ref: VerseRef;
  display: string;
  notes: string[];
  merged: boolean;
  variant: boolean;
}

type VerseRow = [number, number, number, string, string[], number];

export function encodeVerses(vs: readonly StoredVerse[]): string {
  const rows: VerseRow[] = vs.map((v) => [
    v.ref.book,
    v.ref.chapter,
    v.ref.verse,
    v.display,
    v.notes,
    (v.merged ? VERSE_FLAG_MERGED : 0) | (v.variant ? VERSE_FLAG_VARIANT : 0),
  ]);
  return JSON.stringify(rows);
}

export function decodeVerses(json: string): StoredVerse[] {
  return (JSON.parse(json) as VerseRow[]).map(([book, chapter, verse, display, notes, flags]) => ({
    ref: { book, chapter, verse },
    display,
    notes,
    merged: (flags & VERSE_FLAG_MERGED) !== 0,
    variant: (flags & VERSE_FLAG_VARIANT) !== 0,
  }));
}

function encodeInt32(values: readonly number[]): Uint8Array {
  const buf = new Uint8Array(values.length * 4);
  const dv = new DataView(buf.buffer);
  values.forEach((v, i) => dv.setInt32(i * 4, v, true));
  return buf;
}

function decodeInt32(bytes: Uint8Array): number[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: bytes.byteLength / 4 }, (_, i) => dv.getInt32(i * 4, true));
}

export const encodePassages = (ps: ReadonlyArray<{ start: number; end: number }>): Uint8Array =>
  encodeInt32(ps.flatMap((p) => [p.start, p.end]));

export function decodePassages(bytes: Uint8Array): Array<{ start: number; end: number }> {
  const a = decodeInt32(bytes);
  return Array.from({ length: a.length / 2 }, (_, i) => ({ start: a[2 * i]!, end: a[2 * i + 1]! }));
}

export const encodeUnits = (us: ReadonlyArray<{ start: number; end: number; passageId: number }>): Uint8Array =>
  encodeInt32(us.flatMap((u) => [u.start, u.end, u.passageId]));

export function decodeUnits(bytes: Uint8Array): Array<{ start: number; end: number; passageId: number }> {
  const a = decodeInt32(bytes);
  return Array.from({ length: a.length / 3 }, (_, i) => ({ start: a[3 * i]!, end: a[3 * i + 1]!, passageId: a[3 * i + 2]! }));
}
