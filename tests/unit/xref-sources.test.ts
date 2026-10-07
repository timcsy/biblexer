// 守護：spec 004 FR-007、FR-008、Edge Cases（經節編號換算）——串珠資料來源的解析
import { describe, expect, test } from 'vitest';
import { makeOrgToEng, parseTskRefs, parseUbsQuotes, parseUsfmRefs } from '../../scripts/lib/xref-sources.ts';

const r = (book: number, chapter: number, verse: number) => ({ book, chapter, verse });

describe('UBS Parallel Passages：只取新約引用舊約', () => {
  const xml = `﻿<?xml version="1.0" encoding="utf-8"?>
<Passages>
  <Passage>
    <Verse HEB="000000002222">GEN 1:27</Verse>
    <Verse HEB="22200000000">GEN 5:2</Verse>
  </Passage>
  <Passage>
    <Verse HEB="0000003000052222">GEN 1:27</Verse>
    <Verse HEB="222223003000003000">GEN 5:2</Verse>
    <Verse GRK="0000300012252222">MAT 19:4</Verse>
    <Verse GRK="202152222">MRK 10:6-7</Verse>
  </Passage>
  <Passage>
    <Verse GRK="02022220020000">MAT 27:61</Verse>
    <Verse GRK="022222200100">MRK 15:47</Verse>
  </Passage>
</Passages>`;
  test('同時含舊約（HEB）與新約（GRK）的組才收；舊約內部、新約內部的平行不收', () => {
    const q = parseUbsQuotes(xml);
    expect(q).toHaveLength(1);
    expect(q[0]!.ot).toEqual([
      { start: r(1, 1, 27), end: r(1, 1, 27) },
      { start: r(1, 5, 2), end: r(1, 5, 2) },
    ]);
    expect(q[0]!.nt).toEqual([
      { start: r(40, 19, 4), end: r(40, 19, 4) },
      { start: r(41, 10, 6), end: r(41, 10, 7) },
    ]);
  });
  test('參照寫法：單節、範圍、逗號列舉', () => {
    expect(parseUsfmRefs('LUK 6:27-28,35')).toEqual([
      { start: r(42, 6, 27), end: r(42, 6, 28) },
      { start: r(42, 6, 35), end: r(42, 6, 35) },
    ]);
    expect(parseUsfmRefs('2CH 8:13,16')).toEqual([
      { start: r(14, 8, 13), end: r(14, 8, 13) },
      { start: r(14, 8, 16), end: r(14, 8, 16) },
    ]);
  });
});

describe('希伯來文聖經編號 → 英文（和合本）編號', () => {
  const toEng = makeOrgToEng({
    mappedVerses: {
      'PSA 51:0': 'PSA 51:2',
      'PSA 51:1-19': 'PSA 51:3-21',
      'JOL 2:28-32': 'JOL 3:1-5',
      'JOL 3:1-21': 'JOL 4:1-21',
      'MAL 4:1-6': 'MAL 3:19-24',
      'GEN 31:55': 'GEN 32:1',
      'GEN 32:1-32': 'GEN 32:2-33',
      'ROM 16:25a': 'ROM 16:25',
      'BAR 6:1-73': 'LJE 1:1-73',
      'EXO 22:1': 'EXO 21:37',
    },
  });
  test('有對照的換算；沒有對照的不變', () => {
    expect(toEng(r(19, 51, 3))).toEqual(r(19, 51, 1));
    expect(toEng(r(19, 51, 21))).toEqual(r(19, 51, 19));
    expect(toEng(r(29, 3, 1))).toEqual(r(29, 2, 28));
    expect(toEng(r(29, 4, 21))).toEqual(r(29, 3, 21));
    expect(toEng(r(39, 3, 19))).toEqual(r(39, 4, 1));
    expect(toEng(r(1, 32, 1))).toEqual(r(1, 31, 55));
    expect(toEng(r(1, 32, 2))).toEqual(r(1, 32, 1));
    expect(toEng(r(1, 1, 27))).toEqual(r(1, 1, 27));
  });
  test('同一章有別的經節被對照、這一節本身沒有：不變（出 21:24、瑪 3:1——曾被誤判為不存在）', () => {
    expect(toEng(r(2, 21, 24))).toEqual(r(2, 21, 24));
    expect(toEng(r(39, 3, 1))).toEqual(r(39, 3, 1));
  });
  test('詩篇標題（英文編號沒有這一節）：換算不出來，回 null', () => {
    expect(toEng(r(19, 51, 1))).toBeNull();
  });
  test('次經（如 BAR）不在 66 卷正典內：略過、不報錯', () => {
    expect(toEng(r(1, 2, 3))).toEqual(r(1, 2, 3));
  });
  test('半節（帶字母）取節數', () => {
    expect(toEng(r(45, 16, 25))).toEqual(r(45, 16, 25));
  });
});

describe('TSK 參照解析', () => {
  const rom8 = { book: 45, chapter: 8 };
  test('省略書名沿用前一個；只寫節數沿用目前的章；跨書、範圍、逗號', () => {
    const text = '<br />we know.<br /><scripRef>35-39; 5:3,4; Ge 50:20; De 8:2,3,16; Ps 46:1,2</scripRef><br /><scripRef>2Co 4:15-17; 5:1</scripRef>';
    expect(parseTskRefs(text, rom8)).toEqual([
      { start: r(45, 8, 35), end: r(45, 8, 39) },
      { start: r(45, 5, 3), end: r(45, 5, 3) },
      { start: r(45, 5, 4), end: r(45, 5, 4) },
      { start: r(1, 50, 20), end: r(1, 50, 20) },
      { start: r(5, 8, 2), end: r(5, 8, 2) },
      { start: r(5, 8, 3), end: r(5, 8, 3) },
      { start: r(5, 8, 16), end: r(5, 8, 16) },
      { start: r(19, 46, 1), end: r(19, 46, 1) },
      { start: r(19, 46, 2), end: r(19, 46, 2) },
      { start: r(47, 4, 15), end: r(47, 4, 17) },
      { start: r(47, 5, 1), end: r(47, 5, 1) },
    ]);
  });
  test('每個 scripRef 從目前的書與章重新開始', () => {
    expect(parseTskRefs('<scripRef>Ge 1:1</scripRef><scripRef>4</scripRef>', rom8)).toEqual([
      { start: r(1, 1, 1), end: r(1, 1, 1) },
      { start: r(45, 8, 4), end: r(45, 8, 4) },
    ]);
  });
  test('跨章範圍；Jud＝士師記、Jude＝猶大書；Joh＝約翰福音、1Jo＝約翰一書', () => {
    expect(parseTskRefs('<scripRef>Col 1:15-2:3; Jud 2:1; Jude 1:3; Joh 1:1; 1Jo 1:1</scripRef>', rom8)).toEqual([
      { start: r(51, 1, 15), end: r(51, 2, 3) },
      { start: r(7, 2, 1), end: r(7, 2, 1) },
      { start: r(65, 1, 3), end: r(65, 1, 3) },
      { start: r(43, 1, 1), end: r(43, 1, 1) },
      { start: r(62, 1, 1), end: r(62, 1, 1) },
    ]);
  });
  test('略過英文旁註（*marg:、*Gr:）與章首帶 passage 屬性的大綱連結', () => {
    const text = '<br /><scripRef passage="Ge 1:1">1</scripRef> God creates heaven and earth;<br /><scripRef>*marg: or, heavens; Ps 33:6</scripRef><scripRef>*Gr: logos</scripRef>';
    expect(parseTskRefs(text, { book: 1, chapter: 1 })).toEqual([{ start: r(19, 33, 6), end: r(19, 33, 6) }]);
  });
});
