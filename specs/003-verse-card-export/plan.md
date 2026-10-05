# Implementation Plan：輔導用經文卡匯出

**Branch**: `003-verse-card-export` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

## Summary

在搜尋結果與閱讀器加入「加入經文卡」；經文卡以經文位置（起訖節）存在裝置的瀏覽器儲存空間；顯示與列印時由 Worker 依離線資料取出所在段落的經文。列印用瀏覽器的列印功能與列印樣式，列印頁只含經文、出處、上下文範圍標籤與資料來源署名（守護測試＋E2E）。設計決定見 [research.md](./research.md)。

## Technical Context

**Language/Version**：TypeScript ~6.0.3（strict），沿用 001、002
**Primary Dependencies**：沿用（Preact、Vite、Worker 協定）；不新增套件
**Storage**：瀏覽器 localStorage（只存經文位置；每位使用者、每台裝置各自一份）
**Testing**：Vitest（經文卡純函式、段落解析、Worker 訊息、字串守護）；Playwright（加入、整理、保留、列印頁內容白名單、離線）
**Constraints**：不新增網路請求；列印頁不得有系統產生的文字（原則 4）
**Scale/Scope**：一張經文卡、數段到數十段

## Constitution Check

| 原則 | 對應 | 結果 |
|---|---|---|
| TDD | 純函式與 Worker 訊息先寫測試；列印頁白名單以 E2E 守護 | ✅ |
| 繁體中文 | 文件與介面文字 | ✅ |
| 4. 不含任何生成模組 | 列印頁只含經文、出處、範圍標籤、署名；白名單 E2E | ✅ |
| 5. 上下文優先 | 部分經節展開為整個段落並標示所選經節 | ✅ |
| 6. 標示相關，不標示權威 | 順序完全由使用者決定；無分數、無「推薦」 | ✅ |
| 9. 人的判斷要署名 | 列印頁底部署名譯本與分段來源 | ✅ |
| 隱私（vision：輔導情境） | 只存在裝置；E2E 驗證無對外請求 | ✅ |

## Project Structure

```text
src/core/card.ts            # 經文卡純函式：加入（去重）、移動、移除、序列化／驗證、段落解析
src/worker/                 # 新增 card 訊息：依經文位置取出段落經文
src/ui/card/CardPanel.tsx   # 經文卡面板：清單、上移下移、移除、清空、列印
src/ui/card/PrintSheet.tsx  # 列印頁（只在列印時顯示）
src/ui/card/store.ts        # localStorage 讀寫（try/catch）
tests/unit/card.test.ts、card-resolve.test.ts；tests/guards/strings.test.ts（沿用）
e2e/card.spec.ts
```

**Structure Decision**：經文卡的資料邏輯是純函式（`src/core/card.ts`），可在 Node 測試；段落解析在 Worker 端（離線資料都在那裡），UI 只顯示與列印。
