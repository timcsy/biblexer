// 正典的焦點樹（原型第三版）：熟悉的樹形——聖經 → 約 → 類別 → 書卷 → 章，有連線。
// 焦點那一枝展開、其他類別收成一行（焦點加上下文）；換焦點時節點滑到新位置（連續），點章號進入閱讀（離散著陸）。
import { useMemo } from 'preact/hooks';
import { layoutCanonTree, type TreeItem } from '../../reader/canonTree.ts';
import { STRINGS } from '../strings.ts';

const ROW = 30;
const PAD = 24;

export function FocusTree({ focusBook, width, height, onFocus, onEnter }: { focusBook: number; width: number; height: number; onFocus: (book: number) => void; onEnter: (book: number, chapter: number) => void }) {
  const narrow = width < 560;
  const colX = narrow ? [0, 44, 96, 176, 266] : [0, 64, 140, 270, 420];
  const chipW = narrow ? 30 : 34;
  // 窄螢幕：章號格放在書卷下方（縮排），寬度內換列，不會超出畫面
  const chipX0 = narrow ? colX[3]! + 12 : colX[4]!;
  const perRow = Math.max(3, Math.min(12, Math.floor((width - PAD * 2 - chipX0) / chipW)));
  const items = useMemo(() => layoutCanonTree(focusBook, perRow, narrow), [focusBook, perRow, narrow]);
  const rows = Math.max(...items.map((i) => i.row)) + 1;
  const treeW = Math.max(colX[4]!, chipX0 + perRow * chipW);
  const left = Math.max(PAD, (width - treeW) / 2);
  const top = Math.max(PAD, (height - rows * ROW) / 2 - 20);
  const pos = (i: TreeItem) => ({ x: left + (i.kind === 'chapter' ? chipX0 + ((i.chapter! - 1) % perRow) * chipW : colX[i.col]!), y: top + i.row * ROW });
  const byId = new Map(items.map((i) => [i.id, i]));
  const labelW = (i: TreeItem) => [...(i.collapsed !== null ? `${i.label}（${i.collapsed} 卷）` : i.label)].length * (narrow ? 13 : 15) + 10;

  // 連線：父節點右緣 → 主幹 → 每個子節點（章號格只連到第一列）
  const children = new Map<string, TreeItem[]>();
  for (const i of items) if (i.parent && i.kind !== 'chapter') (children.get(i.parent) ?? children.set(i.parent, []).get(i.parent)!).push(i);
  const paths: string[] = [];
  for (const [pid, kids] of children) {
    const p = byId.get(pid)!;
    const pp = pos(p);
    const trunk = left + colX[kids[0]!.col]! - 10;
    const y0 = pp.y + ROW / 2;
    paths.push(`M${pp.x + labelW(p)},${y0} H${trunk}`);
    const last = pos(kids.at(-1)!).y + ROW / 2;
    paths.push(`M${trunk},${y0} V${last}`);
    for (const k of kids) paths.push(`M${trunk},${pos(k).y + ROW / 2} H${trunk + 8}`);
  }
  const focusItem = items.find((i) => i.kind === 'book' && i.current);
  if (focusItem && !narrow) {
    const fp = pos(focusItem);
    paths.push(`M${fp.x + labelW(focusItem)},${fp.y + ROW / 2} H${left + colX[4]! - 4}`);
  }

  return (
    <div class="focus-tree-wrap">
      {/* 底部留出操作提示列的高度，最後幾個節點不會被蓋住 */}
      <div class="focus-tree" data-testid="canon-tree" data-focus-book={focusBook} style={{ height: `${top + rows * ROW + PAD + 64}px` }}>
        <svg class="focus-tree-lines" width={width} height={top + rows * ROW + PAD}>
          {paths.map((d, k) => (
            <path key={k} d={d} />
          ))}
        </svg>
        {items.map((i) => {
          const p = pos(i);
          const cls = `tree-node ${i.kind}${i.current ? ' current' : ''}${i.collapsed !== null ? ' collapsed' : ''}`;
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
              {i.collapsed !== null && <small>{`（${i.collapsed} 卷）`}</small>}
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
