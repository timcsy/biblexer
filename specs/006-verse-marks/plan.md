# 實作計畫：讀者自己的記號

**Spec**：[spec.md](spec.md)

## 技術脈絡

沿用既有架構（Vite、Preact、TypeScript strict、Vitest、Playwright）；不新增套件。

- `src/core/marks.ts`（純函式）：記號的切換、查詢、序列化（容錯：壞資料回空）；以 `book:chapter:verse` 為鍵。
- `src/ui/reader/marks-store.ts`：localStorage 讀寫（鍵 `biblexer.marks.v1`），不能存時只在這次有效——比照 `src/ui/card/store.ts`。
- 精讀層：節號點擊切換；有記號的經節片段加上 `marked` 類別。
- 段落輪廓、書卷層：`MarkBars` 在該節的行旁邊畫色條，寬度依縮放換算，螢幕上至少 4 像素。
- 進度條：記號點；`scrubTarget` 增加記號參數，記號與章刻度取較近者。

## 原則檢查

- 原則 1：記號只疊在版面上，不改變任何座標（E2E 比對 data-pos）。
- 原則 4、9：記號只來自讀者的點擊。
- 離線與隱私：只用 localStorage。
