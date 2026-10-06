// 正典的焦點樹（原型第五版；依研究調整，見 knowledge/draft/2026-10-05-混合曲率作為人機介面的基石.md〈研究〉）：
// - 主視圖是由左往右的樹（邏輯圖），往 SpaceTree 靠攏：順序固定、焦點路徑高亮、收起的分支顯示份量、讀得到才顯示、分步動畫
// - 上方常駐「正典帶」：66 卷依章數比例分段，標出目前位置（我在整本聖經的哪裡）
// - 借用心智圖的視覺語法（不用放射狀版型）：每類一色、分支由粗漸細、標籤貼著分支末端、多留白
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { layoutCanonTree, type TreeItem } from '../../reader/canonTree.ts';
import { STRINGS } from '../strings.ts';

const ROW = 30;
const PAD = 24;
// 上方：操作提示（正典帶已改為閱讀器常駐的一列）——提示放在上方，不遮住樹的節點
const STRIP_H = 30;
/** 展開／收合三段的時間（毫秒）；與 style.css 的 .focus-tree[data-phase] 一致 */
const LEAVE_MS = 180;
const MOVE_MS = 350;
const ENTER_MS = 300;
/** 分支粗細：越靠近根越粗（心智圖的漸細分支） */
const BRANCH = { testament: 4.5, category: 3.2, book: 2, chapter: 1.4 } as const;

/** onChipRects：回報焦點書卷各章號格的螢幕位置（放大到書卷層時的過場起點） */
export function FocusTree({ focusBook, width, onFocus, onEnter, onChipRects }: { focusBook: number; width: number; height: number; onFocus: (book: number) => void; onEnter: (book: number, chapter: number) => void; onChipRects?: (rects: Array<{ chapter: number; rect: DOMRect }>) => void }) {
  const narrow = width < 560;
  const colX = narrow ? [0, 44, 96, 186, 276] : [0, 70, 150, 300, 450];
  const chipW = narrow ? 30 : 34;
  const chipX0 = narrow ? colX[3]! + 12 : colX[4]!;
  const perRow = Math.max(3, Math.min(12, Math.floor((width - PAD * 2 - chipX0) / chipW)));
  // 換焦點的分段過場（展開／收合）：退場（要消失的節點與所有連線淡出）→ 移動（留下的節點滑到新位置，不畫線）
  // → 進場（新節點與連線一起淡入）。連線只在節點靜止時出現，不會伸進空白處（見草稿〈層級過場的研究〉：分段、一致性）
  const [view, setView] = useState<{ book: number; phase: 'idle' | 'leave' | 'move' | 'enter'; leaving: Set<string>; entering: Set<string> }>({ book: focusBook, phase: 'idle', leaving: new Set(), entering: new Set() });
  const viewBook = useRef(view.book);
  viewBook.current = view.book;
  useEffect(() => {
    const from = viewBook.current;
    if (focusBook === from) return;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return setView({ book: focusBook, phase: 'idle', leaving: new Set(), entering: new Set() });
    const cur = layoutCanonTree(from, perRow, narrow);
    const next = layoutCanonTree(focusBook, perRow, narrow);
    const curIds = new Set(cur.map((i) => i.id));
    const nextIds = new Set(next.map((i) => i.id));
    const leaving = new Set(cur.filter((i) => !nextIds.has(i.id)).map((i) => i.id));
    const entering = new Set(next.filter((i) => !curIds.has(i.id)).map((i) => i.id));
    setView({ book: from, phase: 'leave', leaving, entering });
    const timers = [
      setTimeout(() => setView({ book: focusBook, phase: 'move', leaving, entering }), LEAVE_MS),
      setTimeout(() => setView({ book: focusBook, phase: 'enter', leaving, entering }), LEAVE_MS + MOVE_MS),
      setTimeout(() => setView({ book: focusBook, phase: 'idle', leaving: new Set(), entering: new Set() }), LEAVE_MS + MOVE_MS + ENTER_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [focusBook]);
  const items = useMemo(() => layoutCanonTree(view.book, perRow, narrow), [view.book, perRow, narrow]);
  const rows = Math.max(...items.map((i) => i.row)) + 1;
  const treeW = Math.max(colX[4]! + 120, chipX0 + perRow * chipW);
  const left = Math.max(PAD, (width - treeW) / 2);
  const top = PAD;
  const pos = (i: TreeItem) => ({ x: left + (i.kind === 'chapter' ? chipX0 + ((i.chapter! - 1) % perRow) * chipW : colX[i.col]!), y: top + i.row * ROW });
  const byId = new Map(items.map((i) => [i.id, i]));
  const textW = (i: TreeItem) => [...i.label].length * (narrow ? 13 : 15) + (i.kind === 'book' && i.current ? 22 : 12);

  // 分支：父節點右緣 → 子節點左緣。兄弟少（≤ 6）時各自一條平滑曲線（邏輯圖）；
  // 兄弟多時共用一條主幹再分出短枝（SpaceTree 式）——21 卷書信若各畫一條曲線會成為一大片扇形。
  // 焦點路徑實線高亮，其他淡化。
  // 窄螢幕的章號格直接放在書卷下方，縮排已表達從屬關係，不畫連線
  const visible = items.filter((i) => i.parent && !(i.kind === 'chapter' && (narrow || (i.chapter! - 1) % perRow !== 0)));
  const siblings = new Map<string, TreeItem[]>();
  for (const i of visible) (siblings.get(i.parent!) ?? siblings.set(i.parent!, []).get(i.parent!)!).push(i);
  const branches: Array<{ id: string; d: string; palette: string; width: number; onPath: boolean }> = [];
  for (const [pid, kids] of siblings) {
    const p = byId.get(pid)!;
    const a = pos(p);
    const x1 = a.x + textW(p);
    const y1 = a.y + ROW / 2;
    const trunkMode = kids.length > 6;
    const trunkX = pos(kids[0]!).x - 14;
    if (trunkMode) {
      const yLast = pos(kids.at(-1)!).y + ROW / 2;
      branches.push({ id: `${pid}-trunk`, d: `M${x1},${y1} H${trunkX} M${trunkX},${y1} V${yLast}`, palette: kids[0]!.palette ?? 'none', width: BRANCH[kids[0]!.kind as keyof typeof BRANCH] ?? 2, onPath: false });
    }
    for (const i of kids) {
      const b = pos(i);
      const x2 = b.x - 4;
      const y2 = b.y + ROW / 2;
      const mx = (x1 + x2) / 2;
      const onPath = p.current && (i.current || i.kind === 'chapter');
      const d = trunkMode ? `M${trunkX},${y2} H${x2}` : `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
      branches.push({ id: i.id, d: onPath && trunkMode ? `M${x1},${y1} H${trunkX} V${y2} H${x2}` : d, palette: i.palette ?? p.palette ?? 'none', width: BRANCH[i.kind as keyof typeof BRANCH] ?? 2, onPath });
    }
  }

  // 焦點換到下方的類別時，畫面跟過去（等節點滑到新位置後再捲）
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!onChipRects || !scroller.current) return;
    const chips = [...scroller.current.querySelectorAll<HTMLElement>(`[data-testid="tree-chapter"][data-book="${focusBook}"]`)];
    onChipRects(chips.map((c) => ({ chapter: Number(c.dataset.chapter), rect: c.getBoundingClientRect() })));
  });

  useEffect(() => {
    const id = setTimeout(() => {
      const el = scroller.current?.querySelector(`[data-testid="tree-book"][data-book="${focusBook}"]`);
      const smooth = typeof matchMedia === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      el?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
    }, LEAVE_MS + MOVE_MS);
    return () => clearTimeout(id);
  }, [focusBook]);


  return (
    // 滾輪與拖曳停在這裡，不交給背後的閱讀器手勢（否則樹捲不動、相機卻在動）
    <div class="focus-tree-root" onWheel={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <div class="tree-head">
        <p class="tree-hint" data-testid="tree-hint">
          {STRINGS.treeHint}
        </p>
      </div>
      {/* 只有樹捲動；正典帶與提示固定在上方（我在整本聖經的哪裡，永遠看得到） */}
      <div class="focus-tree-wrap" data-testid="canon-tree-scroll" ref={scroller} style={{ top: `${STRIP_H}px` }}>
      <div class="focus-tree" data-testid="canon-tree" data-focus-book={focusBook} data-phase={view.phase} style={{ height: `${top + rows * ROW + PAD + 64}px` }}>
        <svg class="focus-tree-lines" width={width} height={top + rows * ROW + PAD + 64}>
          {branches.map((b) => (
            <path key={b.id} d={b.d} class={`branch p-${b.palette.replace(':', '-')}${b.onPath ? ' on-path' : ''}`} stroke-width={b.width} {...(b.onPath ? { 'data-testid': 'tree-path' } : {})} />
          ))}
        </svg>
        {items.map((i) => {
          const p = pos(i);
          const pal = `p-${(i.palette ?? 'none').replace(':', '-')}`;
          // class 加前綴 k-：避免與其他元件的通用名稱（如展開全章的 .chapter）撞名而繼承到樣式
          const cls = `tree-node k-${i.kind} ${pal}${i.current ? ' current' : ''}${i.collapsed !== null ? ' collapsed' : ''}${view.leaving.has(i.id) ? ' leaving' : ''}${view.entering.has(i.id) ? ' entering' : ''}`;
          // 點章號進入那一章；點目前的書卷進入書首；點其他書卷或收起的類別：焦點移過去
          const click =
            i.kind === 'chapter'
              ? () => onEnter(i.book!, i.chapter!)
              : i.kind === 'book' && i.current
                ? () => onEnter(i.book!, 1)
                : (i.kind === 'category' && i.collapsed !== null) || i.kind === 'book'
                  ? () => onFocus(i.book!)
                  : undefined;
          return (
            <div
              key={i.id}
              class={cls}
              data-testid={`tree-${i.kind}`}
              data-id={i.id}
              {...(i.book !== null ? { 'data-book': i.book } : {})}
              {...(i.chapter !== null ? { 'data-chapter': i.chapter } : {})}
              {...(i.current ? { 'aria-current': 'location' } : {})}
              {...(click ? { role: 'button', tabIndex: 0, onClick: click } : {})}
              style={{ left: `${p.x}px`, top: `${p.y}px`, ...(i.kind === 'chapter' ? { width: `${chipW - 4}px` } : {}) }}
            >
              {i.label}
              {i.collapsed !== null && (
                <>
                  {/* 收起的分支：份量條＋卷數／章數（SpaceTree 研究中「哪個分支較大」錯誤最少的做法） */}
                  <span class="size-bar" data-testid="size-bar" style={{ width: `${Math.max(6, Math.round(((i.chapters ?? 0) / 260) * 70))}px` }} />
                  <small>{`${i.collapsed} 卷／${i.chapters} 章`}</small>
                </>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
