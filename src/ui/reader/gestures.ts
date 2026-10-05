// 手勢 → 相機（research R5）：手勢中只更新相機（transform），放手後吸附到著陸點（根公理）。
// 拖曳＝平移（清除 focus）；雙指、滾輪＝縮放（保留 focus）。
import { panBy, snap, zoomAt, type Camera, type CameraContext } from '../../reader/camera.ts';

export interface GestureTarget {
  camera(): Camera | null;
  ctx(): CameraContext | null;
  set(c: Camera): void;
}

const DRAG_THRESHOLD = 4;
const WHEEL_SETTLE_MS = 180;

export function attachGestures(el: HTMLElement, t: GestureTarget): () => void {
  const pts = new Map<number, { x: number; y: number }>();
  let moved = false;
  let origin: { x: number; y: number } | null = null;
  let wheelTimer: ReturnType<typeof setTimeout> | undefined;

  const local = (e: { clientX: number; clientY: number }) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const settle = () => {
    const c = t.camera();
    const x = t.ctx();
    if (c && x) t.set(snap(c, x));
  };

  const down = (e: PointerEvent) => {
    pts.set(e.pointerId, local(e));
    if (pts.size === 1) {
      moved = false;
      origin = local(e);
    }
  };
  const move = (e: PointerEvent) => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const c = t.camera();
    const x = t.ctx();
    if (!c || !x) return;
    const p = local(e);
    if (pts.size === 1) {
      if (!moved && origin && Math.hypot(p.x - origin.x, p.y - origin.y) < DRAG_THRESHOLD) return;
      if (!moved) {
        moved = true;
        el.setPointerCapture(e.pointerId);
      }
      pts.set(e.pointerId, p);
      t.set(panBy(c, p.x - prev.x, p.y - prev.y, x));
      return;
    }
    // 雙指：以兩指中點縮放；中點的小幅移動跟著手指走，但不算平移（保留 focus）
    const [a, b] = [...pts.entries()].map(([id, q]) => (id === e.pointerId ? p : q));
    const [pa, pb] = [...pts.values()];
    if (!a || !b || !pa || !pb) return;
    const d0 = Math.hypot(pa.x - pb.x, pa.y - pb.y);
    const d1 = Math.hypot(a.x - b.x, a.y - b.y);
    const m0 = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    pts.set(e.pointerId, p);
    moved = true;
    const z = zoomAt(c, d0 > 0 ? d1 / d0 : 1, m0, x);
    t.set({ ...z, x: z.x - (m1.x - m0.x) / z.scale, y: z.y - (m1.y - m0.y) / z.scale });
  };
  const up = (e: PointerEvent) => {
    if (!pts.delete(e.pointerId)) return;
    if (pts.size === 0 && moved) settle();
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const c = t.camera();
    const x = t.ctx();
    if (!c || !x) return;
    // 觸控板雙指縮放會帶 ctrlKey，位移量較小
    const k = e.ctrlKey ? 0.01 : 0.0015;
    t.set(zoomAt(c, Math.exp(-e.deltaY * k), local(e), x));
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(settle, WHEEL_SETTLE_MS);
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', wheel, { passive: false });
  return () => {
    clearTimeout(wheelTimer);
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('wheel', wheel);
  };
}
