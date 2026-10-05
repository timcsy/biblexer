// 守護：spec 003 FR-003、FR-005、FR-010；data-model「驗證」
import { describe, expect, test } from 'vitest';
import { EMPTY_CARD, addItem, deserializeCard, hasItem, moveItem, removeItem, serializeCard, type CardItem } from '../../src/core/card.ts';

const it = (c: number, v: number, c2 = c, v2 = v): CardItem => ({ start: [45, c, v], end: [45, c2, v2] });

describe('經文卡操作', () => {
  test('加入：依加入順序；同一範圍不重複', () => {
    let card = addItem(EMPTY_CARD, it(8, 28));
    card = addItem(card, it(5, 1, 5, 11));
    card = addItem(card, it(8, 28));
    expect(card.items).toEqual([it(8, 28), it(5, 1, 5, 11)]);
    expect(hasItem(card, it(8, 28))).toBe(true);
    expect(hasItem(card, it(8, 29))).toBe(false);
  });

  test('上移、下移；在邊界時不變；不改動原本的卡', () => {
    const card = [it(1, 1), it(2, 1), it(3, 1)].reduce(addItem, EMPTY_CARD);
    expect(moveItem(card, 2, -1).items).toEqual([it(1, 1), it(3, 1), it(2, 1)]);
    expect(moveItem(card, 0, -1)).toEqual(card);
    expect(moveItem(card, 2, 1)).toEqual(card);
    expect(card.items).toEqual([it(1, 1), it(2, 1), it(3, 1)]);
  });

  test('移除', () => {
    const card = [it(1, 1), it(2, 1)].reduce(addItem, EMPTY_CARD);
    expect(removeItem(card, 0).items).toEqual([it(2, 1)]);
    expect(removeItem(card, 5)).toEqual(card);
  });
});

describe('儲存格式', () => {
  test('序列化往返', () => {
    const card = [it(8, 28), it(7, 25, 8, 4)].reduce(addItem, EMPTY_CARD);
    expect(deserializeCard(serializeCard(card))).toEqual(card);
  });

  test('不合法的內容一律視為空卡，不拋例外', () => {
    for (const bad of [null, '', 'garbage', '{}', '{"version":2,"items":[]}', '{"version":1,"items":{}}', '{"version":1,"items":[{"start":[45,8,0],"end":[45,8,1]}]}', '{"version":1,"items":[{"start":[45,8,28],"end":[45,8,27]}]}', '{"version":1,"items":[{"start":[45,8],"end":[45,8,28]}]}', '{"version":1,"items":[{"start":[67,1,1],"end":[67,1,1]}]}'])
      expect(deserializeCard(bad)).toEqual(EMPTY_CARD);
  });
});
