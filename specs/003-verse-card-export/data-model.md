# 資料模型：經文卡匯出

## CardItem（儲存）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `start` | `[book, chapter, verse]` | 所選範圍起點 |
| `end` | `[book, chapter, verse]` | 所選範圍終點（≥ start） |

去重：`start` 與 `end` 都相同者視為同一項。

## Card（儲存）

`{ version: 1, items: CardItem[] }`——順序即使用者排定的順序（FR-010）。

## ResolvedItem（顯示與列印，由 Worker 產生）

| 欄位 | 說明 |
|---|---|
| `label` | 所選範圍的出處（如「羅馬書 8:28」） |
| `contextLabel` | 段落範圍（如「8:28–30」）；與所選範圍相同時為 null |
| `verses` | 段落的 `PresentedVerse[]`，所選範圍內的經節 `inResult = true` |

**驗證**：`deserializeCard` 遇到任何格式錯誤（非陣列、座標非正整數、end < start）就回傳空卡；不拋例外。
