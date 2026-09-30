# Quickstart：驗證離線混合檢索

用來證明本功能端到端可用的驗證步驟。格式與介面細節見 [contracts/](./contracts/)、[data-model.md](./data-model.md)。

## 前置條件

- Node 24、npm
- 首次建置需要網路（下載信望愛資料、eBible 分段、模型）；之後可離線
- Playwright 的 Chromium：`npx playwright install chromium`

## 1. 建立資料

```bash
npm install
npm run build:data        # 下載並核對來源 → public/data/、public/models/、public/ort/
```

預期：`public/data/manifest.json` 存在；主控台列出 66 卷、1,189 章、31,103 節、段落數與檢索單元數；所有來源雜湊核對通過。

## 2. 模型評測（第一步，US3）

```bash
npm run bench
```

預期：產生 `bench/report.md`，每個臂 × 7 個固定查詢的最佳名次；標示被選中的臂。重跑一次，`bench/report.json` 內容不變（`git diff --exit-code bench/report.json`）。

若沒有任何臂達到 7/7：停止，帶著報告與使用者討論（research R3 第 3 條）。

## 3. 自動化測試

```bash
npm test                  # 單元 + 性質測試
npm test -- acceptance    # 選定臂的 7 個固定查詢須 7/7（SC-001）
npm run lint              # 含「不得 import 生成用 pipeline」規則（原則 4）
npm run e2e               # build + preview 後以 Chromium 執行
```

`npm run e2e` 涵蓋：

| 情境 | 驗證 |
|---|---|
| 首次載入 | 顯示下載進度；完成後顯示「已可離線使用」（FR-019） |
| 模型未就緒 | 關鍵字搜尋可用、標示語意準備中（FR-020） |
| 離線 | 暖機後關閉 preview server 並設為離線；重新載入後搜尋、展開全章、篩選皆可用（SC-002） |
| 不外洩 | 搜尋「以馬內利測試」期間，所有請求皆同源，且無任何請求的 URL、內容、標頭含查詢字串（含 URL 編碼、簡繁形式）（SC-003） |
| 段落與出處 | 每筆結果顯示卷章節範圍與約／類別；無孤立單節（SC-006） |
| 措辭 | 結果區標題為「可能相關的段落」；畫面無分數、無禁用字眼（FR-012、FR-014） |
| 篩選 | 選「舊約」後全部結果屬舊約；各約與類別數量正確（FR-016） |
| 出處查詢 | 輸入「羅 8:28」第一筆為該段落（FR-004） |
| 簡體輸入 | 「麦基洗德」與「麥基洗德」的關鍵字結果相同（FR-005） |

## 4. 手動驗證（無法自動化的部分）

在實體手機（約 3 年內的主流 Android 或 iPhone）上：

1. 以約 20 Mbps 的網路首次開啟，計時到「已可離線使用」：須 ≤ 2 分鐘（SC-005）。
2. 開啟飛航模式，重新開啟 app，連續搜尋 20 次，計時送出到結果出現：95% ≤ 1 秒（SC-004）。
3. 輔導情境（SC-009）：由不熟悉經文出處的人，對 vision 表中的 4 個意思型情境各用自己的話描述一次，計時到展開一段可用經文：每次 ≤ 30 秒。

將結果記錄在 `specs/001-offline-hybrid-search/manual-verification.md`（實作階段建立）。
