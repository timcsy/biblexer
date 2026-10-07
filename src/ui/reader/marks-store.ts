// 讀者的記號只存在這台裝置的瀏覽器裡（spec 006 FR-002）。儲存可能不可用或被清除：一律以沒有記號處理。
import { deserializeMarks, serializeMarks, type MarkRef } from '../../core/marks.ts';

const KEY = 'biblexer.marks.v1';

export function loadMarks(): MarkRef[] {
  try {
    return deserializeMarks(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

export function saveMarks(marks: readonly MarkRef[]): void {
  try {
    localStorage.setItem(KEY, serializeMarks(marks));
  } catch {
    /* 不能存就只在這次有效 */
  }
}
