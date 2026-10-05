# 契約：經文卡

## 純函式（`src/core/card.ts`）

```ts
addItem(card: Card, item: CardItem): Card          // 已存在則不變
moveItem(card: Card, index: number, dir: -1 | 1): Card // 邊界時不變
removeItem(card: Card, index: number): Card
hasItem(card: Card, item: CardItem): boolean
serializeCard(card: Card): string
deserializeCard(json: string | null): Card          // 不合法 → 空卡
resolveItem(item: CardItem, verses: StoredVerse[], passages: Passage[]): ResolvedItem | null
```

## Worker 訊息

| 方向 | `type` | 內容 |
|---|---|---|
| UI → Worker | `card` | `{ id, items: CardItem[] }` |
| Worker → UI | `cardResult` | `{ id, items: (ResolvedItem \| null)[] }` |

## UI 測試介面

| 元素 | 屬性 |
|---|---|
| 搜尋結果「加入經文卡」 | `data-testid="add-to-card"`（已加入時 `disabled`、`aria-pressed="true"`） |
| 閱讀器「加入經文卡」 | `data-testid="reader-add-to-card"` |
| 頁首開關 | `data-testid="card-toggle"`（文字含段落數） |
| 面板 | `data-testid="card-panel"`；每段 `data-testid="card-item"`、`data-start`、`data-end`；`card-up`、`card-down`、`card-remove`、`card-clear`、`card-print` |
| 列印頁 | `data-testid="print-sheet"`；文字節點只在 `data-kind="text|note|vnum|ref|attribution"` 之內；書寫欄位 `data-testid="write-lines"` |
