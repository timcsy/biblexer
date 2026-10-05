// 經文卡只存在這台裝置的瀏覽器裡（spec 003 FR-004；research R2）。儲存可能不可用或被清除：一律以空卡處理。
import { EMPTY_CARD, deserializeCard, serializeCard, type Card } from '../../core/card.ts';

const KEY = 'biblexer.card.v1';

export function loadCard(): Card {
  try {
    return deserializeCard(localStorage.getItem(KEY));
  } catch {
    return EMPTY_CARD;
  }
}

export function saveCard(card: Card): void {
  try {
    localStorage.setItem(KEY, serializeCard(card));
  } catch {
    /* 不能存就只在這次有效 */
  }
}
