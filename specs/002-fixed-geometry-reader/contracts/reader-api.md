# 契約：閱讀器核心模組、Worker 訊息與 UI 測試介面

實體定義見 [data-model.md](../data-model.md)。核心模組為純函式（`src/reader/`），可在 Node 測試；UI 只透過它們與 Worker 使用資料。

## 1. 核心函式（`src/reader/`）

```ts
// layout.ts —— 與視窗無關的方格排版
layoutBook(input: { book: number; verses: BookVerse[]; paragraphStarts: number[] }, params?: LayoutParams): Layout
isClosingPunct(ch: string): boolean   // 不可出現在行首
isOpeningPunct(ch: string): boolean   // 不可出現在行尾

// world.ts —— 版面 → 世界座標
lineRect(layout: Layout, line: LinePos): Rect
pageRect(layout: Layout, page: number): Rect
bookTiles(layout: Layout): Array<{ book: number; rect: Rect }>   // 正典層級 66 卷

// camera.ts —— 層級、著陸點、吸附
levelOf(scale: number, readingScale: number): ZoomLevel
landingPoints(layout: Layout, level: ZoomLevel): LandingPoint[]
snap(camera: Camera, ctx: CameraContext): Camera          // 冪等；結果在著陸點集合內
zoomAt(camera: Camera, factor: number, anchor: Point, ctx: CameraContext): Camera  // 保留 focus
panBy(camera: Camera, dx: number, dy: number, ctx: CameraContext): Camera          // 清除 focus
cameraForVerse(verseIdx: number, ctx: CameraContext): Camera // 精讀層、該節所在段落起點
```

```ts
// 2026-10-05 新增（research R3a、R4a、R5a、R8）
arrange(layout: Layout, a: 'strip' | 'grid' | 'chapters'): Layout     // world.ts：只改世界擺放，版面不變
remap(camera: Camera, from: CameraContext, to: CameraContext): Camera // 排列切換：停在著陸點就放到同一著陸點，否則中心最近的行不動
flyPath(a: Camera, b: Camera, ctx: CameraContext): { duration: number; at(t: number): Camera } // 過場路徑；at(1) 恰為 b
snapToward(c: Camera, from: Camera, ctx: CameraContext): Camera        // 平移放手：精讀層一次翻一框（閱讀順序）
step(c: Camera, ctx: CameraContext, dir: 1 | -1, unit: 'landing' | 'frame'): Camera // 方向鍵逐段／翻框
tapTarget(c: Camera, pt: Point, ctx: CameraContext): Camera | null     // 書卷、段落輪廓層點擊 → 該處段落的精讀著陸點
scrubTarget(f: number, ctx: CameraContext): { chapter: number; page: number; camera: Camera } // 進度條
```

### 行為保證（皆有測試）

| 保證 | 測試類型 |
|---|---|
| 每行 ≤ 18 格（懸掛時 ≤ 19 且第 19 格為結尾標點） | 性質 |
| 行首不為結尾標點；行尾不為開頭標點 | 性質 |
| 段落起點、章起點都在行首；段落首行縮排 2 格 | 單元＋性質 |
| 每個非佔位經節恰有一個 `VersePos`，且依序遞增 | 性質 |
| 合併節：佔位節不佔格，承載節節號為範圍 | 單元 |
| `snap` 冪等，結果屬於該層級著陸點集合 | 性質 |
| 從精讀著陸點只縮放再放大回精讀並吸附 → 回到原點 | 性質 |
| `scale` 夾在邊界內 | 性質 |
| 精讀層吸附後頂端對齊行的上緣 | 單元 |

## 2. Worker 訊息（擴充階段 1 協定）

| 方向 | `type` | 內容 |
|---|---|---|
| UI → Worker | `book` | `{ id, book }` |
| Worker → UI | `bookResult` | `{ id, verses: PresentedVerse[], paragraphStarts: number[] }`（`paragraphStarts` 為本書第一節起算的相對索引） |

沿用階段 1 的經文與段落資料；不新增網路請求。

## 3. UI 測試介面（E2E 依賴的屬性）

| 元素 | 屬性 |
|---|---|
| 閱讀器根元素 | `data-testid="reader"`、`data-level="canon|book|outline|reading"`、`data-focus="<landing id>"` |
| 經節（精讀層） | `data-testid="verse"`、`data-ref="45:8:28"`、`data-pos="<page>:<column>:<line>:<cell>"` |
| 行（精讀層） | `data-testid="line"`、`data-line="<page>:<column>:<line>"` |
| 可見區域 | `data-testid="reader-viewport"` |
| 縮放按鈕 | `data-testid="zoom-in"`、`data-testid="zoom-out"` |
| 分段署名 | `data-testid="segmentation-attribution"`（含「新標點和合本」） |
| 搜尋結果上的入口 | `data-testid="open-in-reader"`（只在羅馬書範圍內出現） |
| 返回搜尋 | `data-testid="reader-back"` |
| 命中範圍 | 精讀層的經節加上 `data-hit="true"` |
| 排列（2026-10-05） | 閱讀器根元素 `data-arrangement="strip|grid"`、`data-book-style="map|grid"`；切換按鈕 `data-testid="arrangement-toggle"`、`data-testid="bookstyle-toggle"` |
| 段落標記 | `data-testid="para-mark"`、`data-line="<page>:<column>:<line>"`（目前段落所占的行） |
| 進度與拖動 | `data-testid="reader-progress"`（「第幾章 · 第幾／N 頁」）、`data-testid="reader-scrub"`（可拖動）、`data-testid="scrub-tick"`＋`data-chapter`、`data-testid="scrub-thumb"` |
| 書卷層章號 | `data-testid="book-chapter"`＋`data-chapter`（可點擊；目前的章 `aria-current="location"`） |
| 段落輪廓目前段落 | `data-testid="outline-para"` 加 `aria-current="location"` |
