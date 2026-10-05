# Quickstart：驗證固定幾何閱讀器

前置條件與資料建置同 [001 quickstart](../001-offline-hybrid-search/quickstart.md) 第 1 節（本功能不新增資料）。介面與屬性見 [contracts/reader-api.md](./contracts/reader-api.md)。

## 1. 自動化測試

```bash
npm test          # 含排版與相機的單元／性質測試
npm run e2e       # 含閱讀器 E2E
```

| 情境 | 驗證 |
|---|---|
| 跨裝置一致（SC-001） | 以 390×844、820×1180、1440×900 三種視窗開啟羅馬書，讀出 433 節的 `data-pos`，三者完全相同 |
| 不切行（SC-002） | 精讀層級吸附後，所有可見行的上下緣都在 `reader-viewport` 之內 |
| 縮放與吸附 | 按 `zoom-out` 到各層級，`data-level` 依序變化；每次放手後 `data-focus` 為該層級的著陸點 |
| 回到原處（SC-003） | 從羅 8:28 所在著陸點縮小到正典再放大回精讀，`data-focus` 與原本相同 |
| 搜尋 → 閱讀器（SC-004） | 搜尋「萬事都互相效力」，點 `open-in-reader`，閱讀器開在命中段落起點、命中經節 `data-hit="true"`；`reader-back` 回到結果 |
| 署名 | 閱讀器顯示 `segmentation-attribution`（新標點和合本分段） |
| 離線 | 沿用 001 的離線 E2E：離線時閱讀器可用 |

## 2. 手動驗證

1. 在手機上連續雙指縮放 10 次（精讀 ↔ 正典），主觀上流暢、無跳格（SC-005）。
2. 在桌機上記下某節的頁／欄／行，換到手機開啟同一節，10 秒內找到同一位置（SC-006）。

結果記在 `specs/002-fixed-geometry-reader/manual-verification.md`。
