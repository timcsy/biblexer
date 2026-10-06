// 正典的雙曲全貌（原型第二版）：正典 → 約 → 書卷 → 章 嵌入龐加萊圓盤，焦點書卷在圓心（焦點加上下文）。
// 第一版的回饋：「第一次看到不知道如何使用」——所以這一版讓可操作性看得出來：
// 固定的操作提示列、可點元素的懸停回饋、從「目前書卷放大」拉遠進入（看得出自己怎麼到這裡）、
// 舊約在左／新約在右的方向地標、章緊貼書卷、角度依篇幅分配、拖曳移動焦點並在放手時吸附（連續地探索、離散地著陸）。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BOOKS, CHAPTER_COUNTS, VERSE_COUNTS } from '../../core/canon.ts';
import { canonTreeV2, dragFocus, embedWeighted, focusOn, geodesicFocus, nearestBook, type Point } from '../../reader/hyperbolic.ts';
import { STRINGS } from '../strings.ts';

// 邊長：書卷之間不要太遠（相鄰書卷要看得到——畫面線索），章緊貼書卷
const TAU = { testament: 0.9, book: 1.5, chapter: 0.85 };
const DRAG_THRESHOLD = 4;
/** 約的標籤：兩個太靠近時只留離圓心近的那一個（避免重疊） */
function testamentLabels<T extends { s: { x: number; y: number; k: number } }>(xs: T[]): T[] {
  const visible = xs.filter((x) => x.s.k > 0.05);
  if (visible.length === 2 && Math.hypot(visible[0]!.s.x - visible[1]!.s.x, visible[0]!.s.y - visible[1]!.s.y) < 80) return [visible[0]!.s.k > visible[1]!.s.k ? visible[0]! : visible[1]!];
  return visible;
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function HyperbolicCanon({ focusBook, width, height, onFocus, onEnter }: { focusBook: number; width: number; height: number; onFocus: (book: number) => void; onEnter: (book: number, chapter: number) => void }) {
  const tree = useMemo(() => canonTreeV2(CHAPTER_COUNTS.map((n, i) => [i + 1, n, VERSE_COUNTS[i]!] as [number, number, number])), []);
  const pts = useMemo(() => embedWeighted(tree, TAU), [tree]);
  const bookNode = useMemo(() => new Map(tree.map((n, i) => [n, i] as const).filter(([n]) => n.kind === 'book').map(([n, i]) => [n.book!, i])), [tree]);
  const target = pts[bookNode.get(focusBook)!]!;
  const [focus, setFocus] = useState<Point>(target);
  const focusRef = useRef(focus);
  focusRef.current = focus;
  // 進入時從「目前書卷放大」拉遠到全貌：讀者看得出自己是從哪裡來的
  const [zoom, setZoom] = useState(reducedMotion() ? 1 : 3.2);
  const anim = useRef<number | null>(null);

  const animateTo = (to: Point) => {
    if (anim.current !== null) cancelAnimationFrame(anim.current);
    const from = focusRef.current;
    if (reducedMotion()) return setFocus(to);
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 450);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setFocus(t >= 1 ? to : geodesicFocus(from, to, e));
      anim.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    anim.current = requestAnimationFrame(tick);
  };
  useEffect(() => animateTo(target), [focusBook]);
  useEffect(() => {
    if (zoom === 1) return;
    const t0 = performance.now();
    let id = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 700);
      setZoom(1 + 2.2 * (1 - t) ** 3);
      if (t < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => () => void (anim.current !== null && cancelAnimationFrame(anim.current)), []);

  const R = Math.min(width, height) * 0.45;
  const cx = width / 2;
  const cy = height / 2 - 12;
  const screen = (p: Point) => {
    const q = focusOn(focus, p);
    return { x: cx + q[0] * R * zoom, y: cy + q[1] * R * zoom, k: 1 - (q[0] * q[0] + q[1] * q[1]) };
  };

  // 拖曳：焦點跟著手連續移動；放手吸附到最近的書卷
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    e.stopPropagation();
    if (anim.current !== null) cancelAnimationFrame(anim.current);
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!d.moved) (e.currentTarget as Element).setPointerCapture(e.pointerId);
    d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    setFocus(dragFocus(focusRef.current, [dx / (R * zoom), dy / (R * zoom)]));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    const b = nearestBook(focusRef.current, tree, pts);
    if (b === focusBook) animateTo(target);
    else onFocus(b);
  };
  const wasDrag = () => drag.current?.moved === true;

  const nodes = tree.map((n, i) => ({ n, i, s: screen(pts[i]!) }));
  // 書卷名稱避讓：越靠近圓心越優先；與已放的名稱重疊就只畫點（名稱太擠會變成雜訊）
  const labeled = new Set<number>();
  const boxes: Array<[number, number, number, number]> = [];
  for (const { n, s } of nodes.filter(({ n, s }) => n.kind === 'book' && s.k > 0.04).sort((a, b) => b.s.k - a.s.k)) {
    const b = BOOKS[n.book! - 1]!;
    const size = Math.max(8, 22 * Math.sqrt(s.k));
    const text = s.k > 0.3 ? b.name : b.short;
    const w = text.length * size;
    const box: [number, number, number, number] = [s.x - w / 2, s.y - Math.max(5, 11 * s.k) - size, s.x + w / 2, s.y - Math.max(5, 11 * s.k)];
    if (boxes.some((o) => box[0] < o[2] && o[0] < box[2] && box[1] < o[3] && o[1] < box[3])) continue;
    boxes.push(box);
    labeled.add(n.book!);
  }
  return (
    <div class="hyper-wrap">
      <svg class="hyper-canon" data-testid="hyper-canon" data-focus-book={focusBook} width={width} height={height} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <circle cx={cx} cy={cy} r={R * zoom} class="hyper-disk" />
        {testamentLabels(nodes.filter(({ n }) => n.kind === 'testament')).map(({ n, s }) => (
            <text key={`t${n.testament}`} class="hyper-testament" data-testid="hyper-testament" x={s.x} y={s.y} font-size={Math.max(14, 40 * s.k)} text-anchor="middle">
              {n.testament === 'OT' ? STRINGS.oldTestament : STRINGS.newTestament}
            </text>
          ))}
        {nodes
          .filter(({ n, s }) => n.kind === 'book' && s.k > 0.002)
          .map(({ n, s }) => {
            const b = BOOKS[n.book! - 1]!;
            const focused = n.book === focusBook;
            const size = Math.max(8, 22 * Math.sqrt(s.k));
            return (
              <g key={`b${n.book}`} class={focused ? 'hyper-book focused' : `hyper-book ${b.testament === 'OT' ? 'ot' : 'nt'}`} data-testid="hyper-book" data-book={n.book} {...(focused ? { 'aria-current': 'location' } : {})} onClick={() => !wasDrag() && onFocus(n.book!)} role="button">
                <circle cx={s.x} cy={s.y} r={Math.max(2.5, 8 * s.k)} />
                {labeled.has(n.book!) && (
                  <text x={s.x} y={s.y - Math.max(5, 11 * s.k)} font-size={size} text-anchor="middle">
                    {s.k > 0.3 ? b.name : b.short}
                  </text>
                )}
              </g>
            );
          })}
        {nodes
          .filter(({ n }) => n.kind === 'chapter' && n.book === focusBook)
          .map(({ n, s }) => (
            <g key={`c${n.book}:${n.chapter}`} class="hyper-chapter" data-testid="hyper-chapter" data-book={n.book} data-chapter={n.chapter} onClick={() => !wasDrag() && onEnter(n.book!, n.chapter!)} role="button">
              <circle cx={s.x} cy={s.y} r={Math.max(7, 12 * Math.sqrt(s.k))} />
              <text x={s.x} y={s.y + 4} font-size={Math.max(9, 12 * Math.sqrt(s.k))} text-anchor="middle">
                {n.chapter}
              </text>
            </g>
          ))}
      </svg>
      <p class="hyper-hint" data-testid="hyper-hint">
        {STRINGS.hyperHint}
      </p>
    </div>
  );
}
