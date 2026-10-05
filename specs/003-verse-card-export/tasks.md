---
description: "經文卡匯出的任務清單"
---

# Tasks：經文卡匯出

**Input**：`specs/003-verse-card-export/`（spec、plan、research、data-model、contracts、quickstart）
**Tests**：TDD（constitution）。純函式與 Worker 訊息先寫測試並確認失敗；E2E 在 UI 前寫好、先紅後綠。

## Phase 1：Foundational（經文卡資料）

- [X] T001 [P] `tests/unit/card.test.ts`：addItem 去重、moveItem 邊界、removeItem、serialize／deserialize 往返、不合法輸入回傳空卡（data-model「驗證」）
- [X] T002 [P] `tests/unit/card-resolve.test.ts`：resolveItem——單節展開為所在段落並標示所選經節；跨段範圍取連續段落；label／contextLabel；合併節；不存在的經節回傳 null
- [X] T003 實作 `src/core/card.ts`；確認 T001、T002 通過
- [X] T004 `tests/unit/worker-protocol.test.ts` 增補 `card` → `cardResult`；實作 `src/worker/protocol.ts`、`engine.ts`（engine.card）、`client.ts`

## Phase 2：User Story 1＋2 — 收集、整理、保留、列印（P1）🎯 MVP

- [X] T005 [US1] [US2] `e2e/card.spec.ts`：加入三段與去重、上移、移除、清空、重新整理（含離線）後保留、列印頁白名單（所有文字節點在 data-kind 白名單內、有書寫欄位與署名、無操作介面）、「節」檢視加入單節呈現整段
- [X] T006 [US2] `src/ui/card/store.ts`（localStorage 讀寫，try/catch）
- [X] T007 [US1] `src/ui/card/CardPanel.tsx`、`src/ui/card/PrintSheet.tsx`；`src/ui/strings.ts` 新增介面文字（不得含「推薦」「最佳」等，守護測試沿用）；列印樣式（`@media print` 只顯示列印頁）
- [X] T008 [US1] 搜尋結果「加入經文卡」（`src/ui/PassageCard.tsx`、`ResultList.tsx`）、頁首開關與面板（`src/main.tsx`）；確認 T005 通過

## Phase 3：User Story 3 — 從閱讀器加入（P2）

- [X] T009 [US3] E2E：閱讀器停在某段按「加入經文卡」→ 卡片出現該段
- [X] T010 [US3] 閱讀器工具列「加入經文卡」（`src/ui/reader/Reader.tsx`，以 `at` 的段落或畫面第一節所在段落）；確認 T009 通過

## Phase 4：Polish

- [ ] T011 全部測試（單元、lint、typecheck、資料、E2E）；README、vision 階段 5 勾選（需列印實測者除外）
- [ ] T012 手動驗證（quickstart「手動」：1 分鐘內完成、A4 實際手寫）——記在 `specs/003-verse-card-export/manual-verification.md`，待使用者
