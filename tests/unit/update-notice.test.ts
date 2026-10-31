// 守護：已安裝的 App 在背景更新後，提示讀者重新載入（2026-11-01）
import { describe, expect, test, vi } from 'vitest';
import { watchForUpdate } from '../../src/pwa/boot.ts';

function fakeContainer(hasController: boolean) {
  const target = new EventTarget();
  return Object.assign(target, { controller: hasController ? {} : null });
}

describe('更新提示', () => {
  test('頁面原本就由 Service Worker 控制，之後換了新的：提示一次', () => {
    const c = fakeContainer(true);
    const onUpdate = vi.fn();
    watchForUpdate(c, onUpdate);
    c.dispatchEvent(new Event('controllerchange'));
    c.dispatchEvent(new Event('controllerchange'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  test('第一次安裝（原本沒有控制者）接管時：不是更新，不提示', () => {
    const c = fakeContainer(false);
    const onUpdate = vi.fn();
    watchForUpdate(c, onUpdate);
    c.dispatchEvent(new Event('controllerchange'));
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
