// 守護：data-model Passage / RetrievalUnit 規則；原則 5（上下文優先）
import { fc, test } from '@fast-check/vitest';
import { expect } from 'vitest';
import { MAX_PASSAGE_VERSES, SEGMENTATION_ID, buildPassages, buildUnits } from '../../src/core/passages.ts';

// 產生一串經節的「章號」序列（非遞減），以及分段起點（經節索引集合）
const corpus = fc
  .array(fc.integer({ min: 1, max: 40 }), { minLength: 1, maxLength: 12 })
  .chain((chapterLengths) => {
    const chapters: number[] = [];
    chapterLengths.forEach((len, i) => {
      for (let k = 0; k < len; k++) chapters.push(i + 1);
    });
    return fc.record({
      chapters: fc.constant(chapters),
      starts: fc.uniqueArray(fc.nat(chapters.length - 1)),
    });
  });

test.prop([corpus])('段落是全部經節的劃分（每節恰屬一段）', ({ chapters, starts }) => {
  const ps = buildPassages(chapters, new Set(starts));
  const owner = new Array<number>(chapters.length).fill(-1);
  for (const p of ps) for (let i = p.start; i <= p.end; i++) {
    expect(owner[i]).toBe(-1);
    owner[i] = p.id;
  }
  expect(owner.every((o) => o >= 0)).toBe(true);
});

test.prop([corpus])('段落不跨章、章首一律是起點、長度 ≤ 12、帶分段視角 id', ({ chapters, starts }) => {
  const ps = buildPassages(chapters, new Set(starts));
  for (const p of ps) {
    expect(chapters[p.start]).toBe(chapters[p.end]);
    expect(p.end - p.start + 1).toBeLessThanOrEqual(MAX_PASSAGE_VERSES);
    expect(p.segmentation).toBe(SEGMENTATION_ID);
  }
  for (let i = 1; i < chapters.length; i++) {
    if (chapters[i] !== chapters[i - 1]) expect(ps.some((p) => p.start === i)).toBe(true);
  }
});

test.prop([corpus])('分段起點都會成為段落起點', ({ chapters, starts }) => {
  const ps = buildPassages(chapters, new Set(starts));
  for (const s of starts) expect(ps.some((p) => p.start === s)).toBe(true);
});

test.prop([corpus])('檢索單元：3 節視窗、在段落內、聯集涵蓋段落每一節', ({ chapters, starts }) => {
  const ps = buildPassages(chapters, new Set(starts));
  const us = buildUnits(ps);
  for (const p of ps) {
    const mine = us.filter((u) => u.passageId === p.id);
    expect(mine.length).toBeGreaterThan(0);
    const len = p.end - p.start + 1;
    for (const u of mine) {
      expect(u.start).toBeGreaterThanOrEqual(p.start);
      expect(u.end).toBeLessThanOrEqual(p.end);
      expect(u.end - u.start + 1).toBe(Math.min(3, len));
    }
    for (let i = p.start; i <= p.end; i++) expect(mine.some((u) => u.start <= i && i <= u.end)).toBe(true);
  }
  expect(us.map((u) => u.id)).toEqual(us.map((_, i) => i));
});
