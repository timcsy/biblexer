# Implementation Plan：串珠（語意近鄰）與原位摺疊比對

**Branch**: `004-parallels-fold` | **Spec**: [spec.md](./spec.md)

## Summary
核心純函式 `parallels(corpus, passageId, k)`：段落向量（單元平均）→ 與全部單元內積 → 依段落取最大 → 排除自身與同章 → 前 k 個段落 id（只回順序）。Worker 新增 `parallels` 訊息，回傳出處與段落經文。閱讀器工具列「串珠」開側邊面板（`ParallelsPanel`），點一筆原位展開、可展開全章；相機狀態完全不經手，FR-005 由 E2E 守護。

## Constitution Check
TDD（純函式、Worker 訊息先寫測試；E2E 先紅）✅；原則 2（摺疊、不跳轉）✅；5（展開全章）✅；6（無分數、中性標題）✅；9（語意相似度屬檢索能力，標明模型）✅；8（第一層資料來源不自行決定，只預留分層）✅。

## Structure
`src/core/parallels.ts`；`src/worker/`（parallels 訊息）；`src/ui/reader/ParallelsPanel.tsx`；`tests/unit/parallels.test.ts`；`e2e/parallels.spec.ts`。
