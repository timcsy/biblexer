// 正典的雙曲全貌（原型）：正典 → 書卷 → 章 嵌入龐加萊圓盤（Sarkar），焦點書卷在圓心（焦點加上下文）。
// 點書卷：焦點沿測地線連續移過去（連續地探索）；點焦點書卷的章：進入那一章的精讀（離散地著陸）。
// 只有焦點書卷顯示章號——雙曲瀏覽的效益取決於畫面線索（Pirolli, Card & Van Der Wege 2003）。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BOOKS, CHAPTER_COUNTS } from '../../core/canon.ts';
import { canonTree, focusOn, geodesicFocus, sarkarEmbed, type Point } from '../../reader/hyperbolic.ts';

const TAU = 3.2;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function HyperbolicCanon({ focusBook, width, height, onFocus, onEnter }: { focusBook: number; width: number; height: number; onFocus: (book: number) => void; onEnter: (book: number, chapter: number) => void }) {
  const tree = useMemo(() => canonTree(CHAPTER_COUNTS.map((n, i) => [i + 1, n] as [number, number])), []);
  const pts = useMemo(() => sarkarEmbed(tree, TAU), [tree]);
  const bookNode = useMemo(() => new Map(tree.map((n, i) => [n, i] as const).filter(([n]) => n.book !== null && n.chapter === null).map(([n, i]) => [n.book!, i])), [tree]);
  const target = pts[bookNode.get(focusBook)!]!;
  const [focus, setFocus] = useState<Point>(target);
  const anim = useRef<number | null>(null);

  // 換焦點：沿測地線連續移動
  useEffect(() => {
    if (anim.current !== null) cancelAnimationFrame(anim.current);
    const from = focus;
    if (reducedMotion()) return setFocus(target);
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 450);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setFocus(t >= 1 ? target : geodesicFocus(from, target, e));
      anim.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    anim.current = requestAnimationFrame(tick);
    return () => {
      if (anim.current !== null) cancelAnimationFrame(anim.current);
    };
  }, [focusBook]);

  const R = Math.min(width, height) * 0.46;
  const cx = width / 2;
  const cy = height / 2;
  const screen = (p: Point) => {
    const q = focusOn(focus, p);
    return { x: cx + q[0] * R, y: cy + q[1] * R, k: 1 - (q[0] * q[0] + q[1] * q[1]) };
  };

  const nodes = tree.map((n, i) => ({ n, i, s: screen(pts[i]!) }));
  return (
    <svg class="hyper-canon" data-testid="hyper-canon" data-focus-book={focusBook} width={width} height={height} onPointerDown={(e) => e.stopPropagation()}>
      <circle cx={cx} cy={cy} r={R} class="hyper-disk" />
      {nodes
        .filter(({ n, s }) => n.book !== null && n.chapter === null && s.k > 0.002)
        .map(({ n, s }) => {
          const b = BOOKS[n.book! - 1]!;
          const focused = n.book === focusBook;
          const size = Math.max(7, 22 * Math.sqrt(s.k));
          return (
            <g key={`b${n.book}`} class={focused ? 'hyper-book focused' : `hyper-book ${b.testament === 'OT' ? 'ot' : 'nt'}`} data-testid="hyper-book" data-book={n.book} {...(focused ? { 'aria-current': 'location' } : {})} onClick={() => onFocus(n.book!)} role="button">
              <circle cx={s.x} cy={s.y} r={Math.max(2, 7 * s.k)} />
              {s.k > 0.05 && (
                <text x={s.x} y={s.y - Math.max(4, 10 * s.k)} font-size={size} text-anchor="middle">
                  {s.k > 0.35 ? b.name : b.short}
                </text>
              )}
            </g>
          );
        })}
      {nodes
        .filter(({ n }) => n.chapter !== null && n.book === focusBook)
        .map(({ n, s }) => (
          <g key={`c${n.book}:${n.chapter}`} class="hyper-chapter" data-testid="hyper-chapter" data-book={n.book} data-chapter={n.chapter} onClick={() => onEnter(n.book!, n.chapter!)} role="button">
            <circle cx={s.x} cy={s.y} r={Math.max(6, 11 * Math.sqrt(s.k))} />
            <text x={s.x} y={s.y + 4} font-size={Math.max(9, 13 * Math.sqrt(s.k))} text-anchor="middle">
              {n.chapter}
            </text>
          </g>
        ))}
    </svg>
  );
}
