# 資料模型：固定幾何閱讀器與語意縮放

**Spec**：[spec.md](./spec.md) ｜ **Research**：[research.md](./research.md)

全部在執行時由階段 1 已下載的經文與段落計算，不新增建置產物、不新增下載。

## 排版

### LayoutParams

| 欄位 | 值 | 說明 |
|---|---|---|
| `cellsPerLine` | 18 | 每行格數；行尾懸掛時該行可到 19 格 |
| `linesPerColumn` | 16 | 每欄行數 |
| `columnsPerPage` | 2 | 每頁欄數 |
| `pagesPerRow` | 6 | 世界中每列頁數 |
| `paragraphIndent` | 2 | 段落首行縮排格數 |

### Cell（格）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `kind` | `text` \| `note` \| `verseNum` \| `chapterLabel` \| `indent` | |
| `char` | string | 一個字元（`verseNum` 為 1～2 位數字或「29–30」，佔 1～2 格；`indent` 為空） |
| `verseIdx` | int \| null | 所屬經節（全書經節索引） |

### LinePos／VersePos

| 實體 | 欄位 | 驗證 |
|---|---|---|
| `LinePos` | `page, column, line`（皆 0 起算） | `line < linesPerColumn`、`column < columnsPerPage` |
| `VersePos` | `verseIdx, start: {page, column, line, cell}, end: {...}` | 每一個非佔位經節恰有一個 `VersePos`；`start` 依經節順序嚴格遞增 |

### Layout

| 欄位 | 說明 |
|---|---|
| `book` | 書卷 id（本階段為 45 羅馬書） |
| `lines` | 所有行（依閱讀順序），每行為 `Cell[]`，附 `LinePos` 與 `paragraphStart`、`chapterStart` 標記 |
| `verses` | `VersePos[]` |
| `pageCount` | 總頁數 |

**性質（性質測試守護）**：
- 每行格數 ≤ 18，懸掛行 ≤ 19 且第 19 格必為結尾標點。
- 行首不為結尾標點；行尾不為開頭標點（除非該行只有此一字）。
- 每個段落起點、章起點都在行首（段落起點行以縮排開始）。
- `layoutBook` 的輸入不含任何視窗資訊——版面與裝置無關由型別保證。

## 世界與相機

### World

以格為單位的二維座標。頁 `p` 的左上角：`x = (p mod pagesPerRow) × pageWidth`，`y = floor(p / pagesPerRow) × pageHeight`，其中 `pageWidth = columnsPerPage × (cellsPerLine + gutter)`、`pageHeight = linesPerColumn × lineHeight + margin`。正典層級的書卷方塊：66 卷依正典順序排成每列 11 卷，每塊與羅馬書的頁面網格外框同大；羅馬書方塊即其頁面網格。

### ZoomLevel

`canon` ｜ `book` ｜ `outline` ｜ `reading`，由 `scale / readingScale` 決定（見 research R4 表格）。

### LandingPoint（著陸點）

| 欄位 | 說明 |
|---|---|
| `id` | 唯一識別，如 `book:45`、`chapter:45:8`、`para:6012`、`coltop:12:1` |
| `level` | 所屬層級 |
| `anchor` | 世界座標中的錨點：行或區塊的左上角（精讀層對齊框的頂端；其他層放在視窗左上角、留固定螢幕邊距——起初用區塊中心，但書首、羅馬書方塊都在世界的左上緣，置中會留下半個空白畫面） |
| `verseIdx` | 對應的第一節（書卷層級的其他卷為 null） |

每個層級的集合：`canon`＝66 卷；`book`＝羅馬書各章起點；`outline`＝段落起點；`reading`＝段落起點 ∪ 欄頂端。

### Camera

| 欄位 | 說明 |
|---|---|
| `x, y` | 視窗錨點在世界中的位置 |
| `scale` | 世界單位 → 螢幕像素 |
| `focus` | 最近一次在精讀層停留的著陸點 id；平移時清除，縮放時保留 |

**狀態轉換**：

```text
手勢中（拖曳／雙指／滾輪）──放手──▶ 吸附：
  level = levelOf(scale)
  scale ← 該層級標準比例
  若 level = reading 且 focus 存在且未平移 → 落在 focus
  否則 → 落在該層級最近的著陸點；若 level = reading，更新 focus
```

**性質（性質測試守護）**：
- `snap(snap(c)) = snap(c)`（冪等）。
- `snap(c)` 的位置屬於 `landingPoints(levelOf(snap(c).scale))`。
- 從精讀著陸點 L 只做縮放（不平移）到任一層級再放大回精讀並吸附，結果為 L。
- `scale` 被夾在 [最小, 最大] 之間。

## 與階段 1 的連接

| 實體 | 說明 |
|---|---|
| `ReaderRequest` | `{ book: 45, verseRange?: {start, end} }`——由搜尋結果開啟時帶入命中範圍 |
| `ReturnState` | 開啟閱讀器前的搜尋狀態（查詢、粒度、篩選、捲動位置），返回時還原 |
