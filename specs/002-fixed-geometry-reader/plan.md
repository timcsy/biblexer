# Implementation Plan：固定幾何閱讀器與語意縮放（羅馬書切片）

**Branch**: `002-fixed-geometry-reader` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-fixed-geometry-reader/spec.md`

## Summary

為羅馬書建立與裝置無關的方格版面（每行 18 格、每欄 16 行、每頁 2 欄），放進一個以「格」為單位的世界座標中；相機在正典、書卷、段落輪廓、精讀四個層級之間連續縮放，放手時吸附到該層級由結構定義的著陸點（書卷、章、段落起點、欄頂端），並以 `focus` 保證「縮小再放大回到原處」。閱讀器是同一個 PWA 的新視圖，沿用階段 1 的離線資料，並接上搜尋結果。設計決定見 [research.md](./research.md)。

**2026-10-05 修訂**：試讀後改為「冊頁長卷」排列（全貌才折疊）、精讀不切開頁（段落以標示線呈現）、過場動畫、可拖動的進度條、縮小後點擊進入、書卷層兩種全貌（章節地圖、頁面網格）。決定與理由見 research R3a～R9；任務見 tasks.md Phase 7。

## Technical Context

**Language/Version**：TypeScript ~6.0.3（strict），沿用 001

**Primary Dependencies**：沿用 001（Preact、Vite、Worker 協定）；不新增套件

**Storage**：不新增；沿用階段 1 已快取的經文與段落

**Testing**：Vitest＋fast-check（排版、相機的單元與性質測試）、Playwright（跨視窗一致、不切行、搜尋 → 閱讀器）

**Target Platform**：同 001（手機、平板、桌機瀏覽器；PWA 離線）

**Project Type**：單一前端 PWA（沿用 001 結構）

**Performance Goals**：縮放期間只更新 CSS transform；精讀層一次渲染 ≤ 3 頁（約 1,800 格）

**Constraints**：版面計算不得接收任何視窗參數（原則 1）；不新增網路請求（原則：離線、隱私）

**Scale/Scope**：羅馬書 433 節、16 章、約 14,280 字 → 約 1,000 行、62 欄、31 頁

## Constitution Check

*GATE：Phase 0 前檢查，Phase 1 設計後重新檢查。* constitution：TDD、繁體中文；原則見 `knowledge/principles.md`。

| 原則 | 本計畫的對應 | 結果 |
|---|---|---|
| Constitution：TDD | 排版與相機皆為純函式，先寫單元／性質測試；跨視窗一致等以 E2E 先紅後綠 | ✅ |
| Constitution：繁體中文 | 文件皆為繁體中文 | ✅ |
| 根公理：連續地探索，離散地著陸 | 同一世界中連續縮放；放手吸附到結構著陸點 | ✅ |
| 1. 位置就是記憶 | 方格排版、`layoutBook` 不接收視窗參數；RWD 只改相機；精讀層不切行 | ✅ |
| 2. 探索空間就是文本自身的結構 | 四個層級沿正典、書卷、章、段落移動 | ✅ |
| 3. 每個比喻都必須能算出來 | 著陸點集合由結構定義並有性質測試；不使用「漸近分數」等用語；Farey 留待階段 4 | ✅ |
| 4. 不含任何生成模組 | 段落輪廓層只顯示範圍與經文開頭字句，無摘要 | ✅ |
| 5. 上下文優先 | 精讀層即全文；從搜尋開啟時落在段落起點並標示命中範圍 | ✅ |
| 6. 標示相關，不標示權威 | 不新增任何排序或評分呈現 | ✅ |
| 8. 西敏神學院傳統 | 只有羅馬書可進入；66 卷正典區塊依新教正典順序 | ✅ |
| 9. 人的判斷要署名 | 閱讀器顯示分段來源（新標點和合本） | ✅ |

**Phase 1 設計後重新檢查**：data-model 與 contracts 未引入視窗相依的排版、未定義的比喻或生成文字；結論同上。

## Project Structure

### Documentation (this feature)

```text
specs/002-fixed-geometry-reader/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/reader-api.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 產生
```

### Source Code (repository root)

```text
src/
├── reader/                 # 純函式，Node 可測
│   ├── layout.ts           # 方格排版、禁則
│   ├── world.ts            # 版面 → 世界座標、正典方塊
│   └── camera.ts           # 層級、著陸點、吸附、縮放／平移、focus
├── ui/reader/
│   ├── Reader.tsx          # 閱讀器根元件：相機狀態、手勢、虛擬化
│   ├── ReadingLayer.tsx    # 精讀層：方格文字
│   ├── OutlineLayer.tsx    # 段落輪廓層：行長條＋段落範圍與開頭字句
│   ├── BookLayer.tsx       # 書卷層：頁面縮圖＋章號
│   ├── CanonLayer.tsx      # 正典層：66 卷方塊
│   └── gestures.ts         # Pointer／wheel／鍵盤 → zoomAt／panBy／snap
├── worker/                 # 新增 book 訊息（engine.book）
└── main.tsx                # 新增閱讀器視圖、搜尋結果的「在閱讀器中開啟」與返回

tests/
├── unit/reader-layout.test.ts、reader-camera.test.ts
└── property/reader-layout.prop.test.ts、reader-camera.prop.test.ts

e2e/
├── reader-geometry.spec.ts  # 跨視窗一致、不切行
├── reader-zoom.spec.ts      # 層級、吸附、回到原處、署名
└── reader-from-search.spec.ts
```

**Structure Decision**：沿用 001 的單一前端專案。排版與相機放在 `src/reader/` 作為純函式，與 UI 分離，讓原則 1、3 的性質可以在 Node 中用性質測試守護。

## 實作順序（交給 /speckit-tasks）

1. 排版（US1 核心）：測試 → `layout.ts` → `world.ts`。
2. 相機（US2 核心）：測試 → `camera.ts`。
3. Worker `book` 訊息與閱讀器 UI（精讀層先，再補三個縮放層）、手勢。
4. 跨視窗一致與不切行的 E2E（US1 驗收）、縮放 E2E（US2 驗收）。
5. 搜尋 → 閱讀器（US3）。
6. 手動驗證（quickstart 第 2 節）、知識回流（vision 階段 2 勾選、教訓）。

## Complexity Tracking

無違反需要辯護。
