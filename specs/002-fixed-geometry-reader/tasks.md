---
description: "固定幾何閱讀器與語意縮放（羅馬書切片）的任務清單"
---

# Tasks：固定幾何閱讀器與語意縮放（羅馬書切片）

**Input**：`specs/002-fixed-geometry-reader/` 的設計文件
**Prerequisites**：[plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/reader-api.md](./contracts/reader-api.md)、[quickstart.md](./quickstart.md)

**Tests**：本專案規定 TDD（`.specify/memory/constitution.md`）。每個測試任務都排在它所驗證的實作任務之前；實作前必須執行測試並確認它因「功能尚未實作」而失敗。若測試第一次就通過，先找出能讓舊實作失敗的情境再重寫（`knowledge/experience.md`「沒有先變紅的測試，不能證明它測到了問題」）。

## Format：`[ID] [P?] [Story] Description`

- **[P]**：可平行（不同檔案、不依賴未完成的任務）
- **[Story]**：所屬使用者故事（US1～US3，對應 spec.md）

---

## Phase 1：Setup

- [ ] T001 依 plan.md 建立目錄 `src/reader/`、`src/ui/reader/`；在 `src/ui/strings.ts` 加入閱讀器的固定介面文字（「閱讀」「在閱讀器中開啟」「返回搜尋」「放大」「縮小」、層級名稱「正典」「書卷」「段落輪廓」「精讀」、分段署名「段落分段：新標點和合本（香港聖經公會）之分段，僅取邊界」、「本階段尚未提供閱讀」），確認 `tests/guards/strings.test.ts` 仍通過（不得含「最佳」「推薦」等字眼）

---

## Phase 2：Foundational（閱讀器取得資料）

**⚠️ CRITICAL**：US1～US3 都需要從 Worker 取得一整卷的經節與段落。

- [ ] T002 [P] 在 `tests/unit/worker-protocol.test.ts` 增補 `book` → `bookResult` 訊息的測試（帶相同 id）；在 `tests/unit/chapter.test.ts` 旁新增 `tests/unit/book.test.ts`：引擎的 `book(45)` 回傳羅馬書所有經節（含合併節的 `mergedTo`）與 `paragraphStarts`（相對於本書第一節的索引），不含任何標題（contracts §2）
- [ ] T003 在 `src/worker/protocol.ts`、`src/worker/engine.ts`、`src/worker/client.ts` 實作 `book` 訊息與 `engine.book()`；確認 T002 通過

**Checkpoint**：UI 能以 `client.book(45)` 取得羅馬書資料。

---

## Phase 3：User Story 1 — 固定版面上讀羅馬書，位置不因裝置而改變（Priority: P1）🎯 MVP

**Goal**：方格排版的羅馬書精讀層；任何視窗寬度下每節的頁／欄／行／格座標相同。

**Independent Test**：以 390×844、820×1180、1440×900 開啟羅馬書，433 節的 `data-pos` 三者完全相同。

### 測試（先寫、先確認失敗）

- [ ] T004 [P] [US1] 在 `tests/unit/reader-layout.test.ts` 撰寫排版單元測試（research R2）：
  - 段落首行縮排 2 格；章起點先佔一行章號標籤「第 N 章」
  - 節號為半形數字、佔 1 格；合併節的佔位節不佔格，承載節節號為「29–30」、佔 2 格
  - 和合本譯註與正文一起排、每字一格，`kind` 為 `note`
  - 一節跨行、跨欄、跨頁時，`VersePos.start` 為起始格、`end` 為結束格
- [ ] T005 [P] [US1] 在 `tests/property/reader-layout.prop.test.ts` 撰寫排版性質測試（data-model「排版」性質）：
  - 「每行格數 ≤ 18，懸掛行 ≤ 19 且第 19 格必為結尾標點」
  - 「行首不為結尾標點；行尾不為開頭標點（除非該行只有此一字）」
  - 「每個段落起點、章起點都在行首」
  - 「每一個非佔位經節恰有一個 `VersePos`；`start` 依經節順序嚴格遞增」
  - 以隨機產生的經節（含標點、譯註、合併節）與段落起點驗證
- [ ] T006 [P] [US1] 在 `tests/unit/reader-world.test.ts` 撰寫世界座標測試：頁 `p` 的左上角為 `x = (p mod 6) × pageWidth`、`y = floor(p / 6) × pageHeight`；同頁兩欄左右相鄰；`bookTiles` 回傳 66 塊、依正典順序每列 11 塊、羅馬書方塊等於其頁面網格外框
- [ ] T007 [P] [US1] 在 `e2e/reader-geometry.spec.ts` 撰寫 E2E（SC-001、FR-003）：
  - 以 390×844、820×1180、1440×900 三種視窗開啟閱讀器，逐頁讀出 433 節的 `data-pos`，三者完全相同
  - 閱讀器顯示 `segmentation-attribution`，內容含「新標點和合本」
  - 視窗寬度改變（在同一頁面中 `setViewportSize`）後 `data-pos` 不變

### 實作

- [ ] T008 [US1] 在 `src/reader/layout.ts` 實作 `layoutBook`、`isClosingPunct`、`isOpeningPunct`（LayoutParams：`cellsPerLine` 18、`linesPerColumn` 16、`columnsPerPage` 2、`pagesPerRow` 6、`paragraphIndent` 2）；函式簽名不得接收任何視窗參數；確認 T004、T005 通過
- [ ] T009 [US1] 在 `src/reader/world.ts` 實作 `lineRect`、`pageRect`、`bookTiles`；確認 T006 通過
- [ ] T010 [US1] 在 `src/ui/reader/ReadingLayer.tsx` 實作精讀層：每格為固定寬度方格（不依字型字寬），經節加 `data-testid="verse"`、`data-ref`、`data-pos`，行加 `data-testid="line"`、`data-line`；譯註次要樣式、節號上標；只渲染視窗附近的頁（前後各 1 頁）
- [ ] T011 [US1] 在 `src/ui/reader/Reader.tsx` 實作閱讀器根元件（`data-testid="reader"`、`data-level`）：以 CSS `transform` 呈現相機（本階段先只有精讀層的平移）、可見區域 `data-testid="reader-viewport"`、分段署名 `data-testid="segmentation-attribution"`；在 `src/main.tsx` 加入「閱讀」視圖入口（開啟羅馬書第 1 章）；確認 T007 通過

**Checkpoint**：羅馬書可在固定版面上閱讀，跨視窗座標一致。

---

## Phase 4：User Story 2 — 連續縮放並吸附到結構點（Priority: P1）

**Goal**：正典、書卷、段落輪廓、精讀四層連續縮放；放手吸附到該層著陸點；縮小再放大回到原處；精讀層不切行。

**Independent Test**：從羅 8:28 縮小到正典再放大回精讀，`data-focus` 不變；任何放手後 `data-focus` 都是該層級的著陸點。

### 測試（先寫、先確認失敗）

- [ ] T012 [P] [US2] 在 `tests/unit/reader-camera.test.ts` 撰寫相機單元測試：
  - `levelOf`：以精讀比例 r 為準，≥ 0.6r 為精讀、0.25r～0.6r 為段落輪廓、0.06r～0.25r 為書卷、< 0.06r 為正典
  - `landingPoints`：正典＝66 卷；書卷＝羅馬書 16 章的起點；段落輪廓＝段落起點；精讀＝段落起點 ∪ 欄頂端
  - 精讀層吸附後頂端對齊行的上緣；可見高度取整數行
  - `cameraForVerse(羅 8:28)` 落在該節所在段落起點的精讀著陸點
- [ ] T013 [P] [US2] 在 `tests/property/reader-camera.prop.test.ts` 撰寫相機性質測試（data-model「相機」性質）：
  - 「`snap(snap(c)) = snap(c)`（冪等）」
  - 「`snap(c)` 的位置屬於 `landingPoints(levelOf(snap(c).scale))`」
  - 「從精讀著陸點 L 只做縮放（不平移）到任一層級再放大回精讀並吸附，結果為 L」
  - 「`scale` 被夾在 [最小, 最大] 之間」
  - `panBy` 清除 `focus`；`zoomAt` 保留 `focus`
- [ ] T014 [P] [US2] 在 `e2e/reader-zoom.spec.ts` 撰寫 E2E（SC-002、SC-003、FR-007～014）：
  - 按 `zoom-out` 依序經過精讀 → 段落輪廓 → 書卷 → 正典，`data-level` 隨之改變，到正典後再按不再變化（邊界）
  - 從羅 8:28 所在著陸點縮小到正典再放大回精讀，`data-focus` 與原本相同
  - 精讀層吸附後，所有可見行（`data-testid="line"`）的上下緣都在 `reader-viewport` 之內
  - 拖曳平移後放手，`data-focus` 為精讀層著陸點（段落起點或欄頂端）
  - 段落輪廓層不出現任何編者標題，只有段落範圍與經文開頭字句
  - 正典層羅馬書以外的書卷顯示「本階段尚未提供閱讀」

### 實作

- [ ] T015 [US2] 在 `src/reader/camera.ts` 實作 `levelOf`、`landingPoints`、`snap`、`zoomAt`、`panBy`、`cameraForVerse`（含 `focus` 規則）；確認 T012、T013 通過
- [ ] T016 [P] [US2] 在 `src/ui/reader/OutlineLayer.tsx` 實作段落輪廓層：每行以長條表示（保留段落形狀），段落旁顯示範圍（如「8:28–30」）與該段經文的開頭字句；不得顯示任何標題或摘要（FR-014）
- [ ] T017 [P] [US2] 在 `src/ui/reader/BookLayer.tsx` 與 `src/ui/reader/CanonLayer.tsx` 實作書卷層（頁面縮圖＋章號）與正典層（66 卷方塊依正典順序、可依舊約／新約分組；羅馬書以外標示「本階段尚未提供閱讀」）
- [ ] T018 [US2] 在 `src/ui/reader/gestures.ts` 實作手勢：Pointer Events 拖曳與雙指縮放、`wheel`、按鈕 `zoom-in`／`zoom-out`、鍵盤（＋／−、方向鍵）；手勢中只更新 transform，放手後呼叫 `snap`；在 `Reader.tsx` 依 `levelOf` 切換四個層級並輸出 `data-focus`；確認 T014 通過

**Checkpoint**：根公理「連續地探索，離散地著陸」可實際操作。

---

## Phase 5：User Story 3 — 從搜尋結果進入閱讀器的對應位置（Priority: P2）

**Goal**：羅馬書範圍內的搜尋結果可直接開在閱讀器的命中段落；可返回搜尋結果。

**Independent Test**：搜尋「萬事都互相效力」，點 `open-in-reader`，閱讀器開在命中段落起點且命中經節 `data-hit="true"`；`reader-back` 回到結果。

### 測試（先寫、先確認失敗）

- [ ] T019 [P] [US3] 在 `e2e/reader-from-search.spec.ts` 撰寫 E2E（SC-004、FR-015、FR-016）：
  - 羅馬書範圍內的結果有 `open-in-reader`；羅馬書以外的結果沒有
  - 點擊後閱讀器的 `data-focus` 為命中段落起點的精讀著陸點，命中範圍內的經節 `data-hit="true"`
  - `reader-back` 回到原本的搜尋結果（查詢、粒度、篩選不變）

### 實作

- [ ] T020 [US3] 在 `src/ui/PassageCard.tsx` 加入「在閱讀器中開啟」（只在羅馬書範圍內）；在 `src/main.tsx` 記住搜尋狀態（ReturnState）、以 `cameraForVerse` 開啟閱讀器並傳入命中範圍、提供 `reader-back`；在 `ReadingLayer.tsx` 標示 `data-hit`；確認 T019 通過

---

## Phase 6：Polish 與跨切面

- [ ] T021 執行全部測試：`npm test`、`npm run lint`、`npm run typecheck`、`npm run build`、`npm run test:data`、`npm run test:acceptance`、`npm run e2e`，確認階段 1 的 21 個 E2E 與驗收未退步，且首次下載量不變（不新增下載）
- [ ] T022 依 quickstart.md 第 2 節做手動驗證（SC-005 縮放流暢、SC-006 跨裝置找回位置），結果記錄在 `specs/002-fixed-geometry-reader/manual-verification.md`（若使用者決定延後，比照 001 T108 註明）
- [ ] T023 知識回流（需使用者確認後才寫入核心檔）：更新 `knowledge/vision.md` 階段 2 勾選與「現狀」；實作中的教訓依四段式提議寫入 `knowledge/experience.md`；檢查 `knowledge/draft/2026-09-30-Farey定址座標系.md` 未解問題「這是閱讀器的主座標，還是只作為雙曲『切面』之一？」是否已可回答並記錄

---

## Dependencies & Execution Order

- **Setup（Phase 1）** → **Foundational（Phase 2）** → **US1（Phase 3）** → **US2（Phase 4）** → **US3（Phase 5）** → **Polish**
- US2 依賴 US1 的版面與世界座標（`layout.ts`、`world.ts`）；US3 依賴 US2 的 `cameraForVerse`
- 故事內部：測試 → 確認失敗 → 純函式實作 → UI → 確認 E2E 通過

### 關鍵路徑

T001 → T002 → T003 → T004/T005/T006 → T008 → T009 → T010 → T011 → T012/T013 → T015 → T018 → T020

## Parallel Examples

```text
Phase 2：T002 可與 Phase 3 的測試 T004～T007 同時撰寫
US1 測試：T004、T005、T006、T007 全部可平行
US2 測試：T012、T013、T014 全部可平行；實作 T016、T017 可平行（不同檔案）
```

## Implementation Strategy

1. **MVP＝US1**：固定版面的羅馬書精讀，跨視窗座標一致——這是「位置就是記憶」的最小可驗證版本。
2. **US2**：加入縮放層級與吸附，完成根公理的第一個實際互動。
3. **US3**：接上階段 1 的搜尋。
4. 每個故事完成就 commit；驗收或 E2E 失敗時修正實作，不放寬測試。
