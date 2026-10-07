// 參照表（spec 004 FR-007、FR-008）：每一節 → 一串目標經節範圍（全本的經節流水號，合併節已歸到前一節）。
// 二進位格式（little-endian）：Uint32 節數 n；Uint32 × (n+1) 每節的起點（以「範圍」計）；Uint16 × 2 × 範圍數（起、迄）。
// 經節流水號最大 31102，放得進 Uint16。

export interface XrefTable {
  verseCount: number;
  targets(verse: number): Array<[number, number]>;
}

export function encodeXrefs(perVerse: ReadonlyArray<ReadonlyArray<readonly [number, number]>>): Uint8Array<ArrayBuffer> {
  const n = perVerse.length;
  const total = perVerse.reduce((s, t) => s + t.length, 0);
  const buf = new ArrayBuffer(4 + 4 * (n + 1) + 4 * total);
  const head = new DataView(buf);
  head.setUint32(0, n, true);
  const pairs = new DataView(buf, 4 + 4 * (n + 1));
  let k = 0;
  perVerse.forEach((t, v) => {
    head.setUint32(4 + 4 * v, k, true);
    for (const [s, e] of t) {
      pairs.setUint16(4 * k, s, true);
      pairs.setUint16(4 * k + 2, e, true);
      k++;
    }
  });
  head.setUint32(4 + 4 * n, k, true);
  return new Uint8Array(buf);
}

export function decodeXrefs(buf: ArrayBuffer): XrefTable {
  const head = new DataView(buf);
  const n = head.getUint32(0, true);
  const pairs = new DataView(buf, 4 + 4 * (n + 1));
  return {
    verseCount: n,
    targets(v) {
      if (v < 0 || v >= n) return [];
      const a = head.getUint32(4 + 4 * v, true);
      const b = head.getUint32(4 + 4 * (v + 1), true);
      const out: Array<[number, number]> = [];
      for (let k = a; k < b; k++) out.push([pairs.getUint16(4 * k, true), pairs.getUint16(4 * k + 2, true)]);
      return out;
    },
  };
}

/** 一段（第 start～end 節）的參照：依節的順序、各節內依原順序；去除重複；與段落本身重疊的不列 */
export function xrefsForPassage(table: XrefTable, start: number, end: number): Array<[number, number]> {
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  for (let v = start; v <= end; v++) {
    for (const [s, e] of table.targets(v)) {
      if (s <= end && e >= start) continue;
      const k = `${s}-${e}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push([s, e]);
    }
  }
  return out;
}
