// 正典的焦點樹（原型第五版；依研究調整，見 knowledge/draft/2026-10-05-混合曲率作為人機介面的基石.md〈研究〉）：
// - 主視圖是由左往右的樹（邏輯圖），往 SpaceTree 靠攏：順序固定、焦點路徑高亮、收起的分支顯示份量、讀得到才顯示、分步動畫
// - 上方常駐「正典帶」：66 卷依章數比例分段，標出目前位置（我在整本聖經的哪裡）
// - 借用心智圖的視覺語法（不用放射狀版型）：每類一色、分支由粗漸細、標籤貼著分支末端、多留白
import { useMemo } from 'preact/hooks';
import { BOOKS } from '../../core/canon.ts';
import { canonStrip, layoutCanonTree, type TreeItem } from '../../reader/canonTree.ts';
import { STRINGS } from '../strings.ts';

const ROW = 30;
const PAD = 24;
const STRIP_H = 54;
/** 分支粗細：越靠近根越粗（心智圖的漸細分支） */
const BRANCH = { testament: 4.5, category: 3.2, book: 2, chapter: 1.4 } as const;

export function FocusTree({ focusBook, width, onFocus, onEnter }: { focusBook: number; width: number; height: number; onFocus: (book: number) => void; onEnter: (book: number, chapter: number) => void }) {
  const narrow = width < 560;
  const colX = narrow ? [0, 44, 96, 186, 276] : [0, 70, 150, 300, 450];
  const chipW = narrow ? 30 : 34;
  const chipX0 = narrow ? colX[3]! + 12 : colX[4]!;
  const perRow = Math.max(3, Math.min(12, Math.floor((width - PAD * 2 - chipX0) / chipW)));
  const items = useMemo(() => layoutCanonTree(focusBook, perRow, narrow), [focusBook, perRow, narrow]);
  const strip = useMemo(() => canonStrip(), []);
  const rows = Math.max(...items.map((i) => i.row)) + 1;
  const treeW = Math.max(colX[4]! + 120, chipX0 + perRow * chipW);
  const left = Math.max(PAD, (width - treeW) / 2);
  const top = STRIP_H + PAD;
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

  const stripW = Math.min(width - PAD * 2, 1100);
  const stripL = (width - stripW) / 2;

  return (
    <div class="focus-tree-wrap">
      {/* 正典帶：我在整本聖經的哪裡 */}
      <div class="canon-strip" data-testid="canon-strip" style={{ left: `${stripL}px`, width: `${stripW}px` }}>
        <div class="strip-bar">
          {strip.map((s) => (
            <span
              key={s.book}
              class={`strip-seg p-${s.palette.replace(':', '-')}${s.book === focusBook ? ' current' : ''}`}
              data-testid="strip-seg"
              data-book={s.book}
              title={BOOKS[s.book - 1]!.name}
              role="button"
              {...(s.book === focusBook ? { 'aria-current': 'location' } : {})}
              style={{ left: `${s.x0 * 100}%`, width: `${(s.x1 - s.x0) * 100}%` }}
              onClick={() => onFocus(s.book)}
            />
          ))}
        </div>
        <div class="strip-labels">
          <span>{STRINGS.oldTestament}</span>
          <span class="strip-here" style={{ left: `${((strip[focusBook - 1]!.x0 + strip[focusBook - 1]!.x1) / 2) * 100}%` }}>
            {BOOKS[focusBook - 1]!.name}
          </span>
          {/* 「新約」與目前書卷名稱太近時只留書卷名稱 */}
          {Math.abs((strip[focusBook - 1]!.x0 + strip[focusBook - 1]!.x1) / 2 - strip[39]!.x0) * stripW > 70 && <span style={{ left: `${strip[39]!.x0 * 100}%` }}>{STRINGS.newTestament}</span>}
        </div>
      </div>
      <div class="focus-tree" data-testid="canon-tree" data-focus-book={focusBook} style={{ height: `${top + rows * ROW + PAD + 64}px` }}>
        <svg class="focus-tree-lines" width={width} height={top + rows * ROW + PAD + 64}>
          {branches.map((b) => (
            <path key={b.id} d={b.d} class={`branch p-${b.palette.replace(':', '-')}${b.onPath ? ' on-path' : ''}`} stroke-width={b.width} {...(b.onPath ? { 'data-testid': 'tree-path' } : {})} />
          ))}
        </svg>
        {items.map((i) => {
          const p = pos(i);
          const pal = `p-${(i.palette ?? 'none').replace(':', '-')}`;
          const cls = `tree-node ${i.kind} ${pal}${i.current ? ' current' : ''}${i.collapsed !== null ? ' collapsed' : ''}`;
          const click =
            i.kind === 'chapter' ? () => onEnter(i.book!, i.chapter!) : (i.kind === 'category' && i.collapsed !== null) || (i.kind === 'book' && !i.current) ? () => onFocus(i.book!) : undefined;
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
      <p class="hyper-hint" data-testid="tree-hint">
        {STRINGS.treeHint}
      </p>
    </div>
  );
}
