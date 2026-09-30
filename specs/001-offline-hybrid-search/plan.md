# Implementation Plan：離線混合檢索（全本和合本）

**Branch**: `001-offline-hybrid-search` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-offline-hybrid-search/spec.md`

## Summary

在瀏覽器中、完全離線地對和合本（神版）全本做「語意＋關鍵字」混合檢索，結果以段落呈現並附上下文。實作的第一步是評測：以固定查詢比較數個小型中文 embedding 模型，挑出下載量可接受且能讓 7 個固定查詢全部進前 5 名的方案，之後才做介面。

技術路線（見 [research.md](./research.md)）：
- 建置時：從信望愛下載 `unv` 經文、從 eBible 取分段邊界（不取標題），切成 3 節檢索單元，在 Node 用與瀏覽器相同的 ONNX 模型預先算好 int8 向量，並建好字元 bigram BM25 索引。
- 執行時：transformers.js 在 Web Worker 中計算查詢向量，暴力內積＋BM25，以 RRF 融合後聚合回段落。
- 離線：Service Worker 預先快取 app shell 與經文；模型與向量以可顯示進度的方式下載到 Cache Storage；ONNX Runtime WASM 自行託管。

## Technical Context

**Language/Version**：TypeScript ~6.0.3（strict），Node 24（建置、測試、評測）

**Primary Dependencies**：
- Vite 8.3、vite-plugin-pwa 1.3（Workbox 7.4）
- `@huggingface/transformers` 4.3（onnxruntime-web / onnxruntime-node）
- Preact
- opencc-js 1.4（`cn2t`，延遲載入）

**Storage**：靜態檔＋瀏覽器 Cache Storage（唯讀資料）；不儲存任何查詢或使用紀錄

**Testing**：
- Vitest 5、fast-check 4 ＋ `@fast-check/vitest`
- Playwright 1.63（Chromium，跑在 `vite build && vite preview` 上）
- ESLint 10 ＋ typescript-eslint 8.71

**Target Platform**：近年的行動與桌面瀏覽器（Chromium、Safari、Firefox）；PWA 可安裝

**Project Type**：單一前端 Web 應用（PWA）＋建置腳本＋評測工具；無後端

**Performance Goals**：
- 模型就緒後，中階手機上送出查詢到顯示結果 ≤ 1 秒（p95）
- 建置時計算向量 ≤ 15 分鐘

**Constraints**：
- 首次下載總量 ≤ 200 MB
- 首次載入後完全離線
- 執行期只發同源請求，且不含查詢內容
- 不含任何文字生成模型

**Scale/Scope**：
- 66 卷、1,189 章、31,103 節
- 約 6,000 段落、約 1.5～2 萬檢索單元
- 7 個固定驗收查詢

## Constitution Check

*GATE：Phase 0 前檢查，Phase 1 設計後重新檢查。*

`.specify/memory/constitution.md` 規定 TDD 與繁體中文，其餘原則指向 `knowledge/principles.md`。

| 原則 | 本計畫的對應 | 結果 |
|---|---|---|
| Constitution：使用 TDD | 每個核心函式先寫單元／性質測試；評測先以「7/7」驗收測試作為 Red；E2E 守護離線與不外洩；tasks 會把測試排在實作前 | ✅ |
| Constitution：繁體中文 | 所有 spec 產出文件皆為繁體中文；識別字保留英文 | ✅ |
| 1. 位置就是記憶 | 本功能無閱讀器；「展開全章」定位到命中段落。固定幾何屬階段 2 | ✅（不適用部分延後） |
| 2. 探索空間就是文本自身的結構 | 搜尋沿語意鄰近與字詞共現移動；分類篩選沿正典結構（約／類別） | ✅ |
| 3. 每個比喻都必須能算出來 | 用到的數學名詞都對應函式與性質測試：BM25、RRF、int8 內積、經節範圍重疊（contracts/search-api.md） | ✅ |
| 4. 不含任何生成模組 | 只用 feature-extraction 模型；ESLint 禁止 `pipeline` 等 import；測試掃描 `src/**`；`public/models/` 只允許一個 embedding 模型 | ✅ |
| 5. 上下文優先 | 結果單位為段落＋前後各 2 節；一鍵展開全章；複製附出處 | ✅ |
| 6. 標示相關，不標示權威 | 不顯示分數；「可能相關的段落」；介面字串禁用字眼由測試守護 | ✅ |
| 7. 測試先行 | 同 Constitution：TDD | ✅ |
| 8. 西敏神學院傳統為設計準則 | 只收 66 卷（信望愛資料恰為 66 卷）；舊約／新約兩層分類；不顯示段落標題；和合本譯註保留（依西敏信條 1.8，把讀者指向原文）；分段作為可替換的「視角層」（見下方說明） | ✅ |

**原則 8：段落邊界是一種視角（2026-09-30 使用者決定）**。分段會因不同的神學與釋經判斷而不同；使用者的看法是：隨著更多視角加入，會逐漸收斂。因此：
- 本功能先採用新標點和合本（神版）的分段，作為**第一個分段視角**。
- 分段設計成**可替換、可並存的資料層**：每一組段落邊界帶有來源 id（`segmentation`），檢索單元與結果都記錄自己依據的是哪一組分段；日後加入其他分段視角時，不需要改檢索核心。
- 驗收與命中判定以「經節範圍重疊」為準，不依賴特定的分段，因此換分段不會讓評測失效。

**Phase 1 設計後重新檢查**：data-model 與 contracts 沒有引入分數顯示、生成文字、孤立單節或外部請求，結論同上。

## Project Structure

### Documentation (this feature)

```text
specs/001-offline-hybrid-search/
├── plan.md              # 本檔
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── search-api.md    # 核心函式、Worker 訊息、UI 文字契約
│   ├── data-artifacts.md# 建置產物格式與來源
│   └── benchmark.md     # 評測指令、查詢集、報告與規則
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 產生
```

### Source Code (repository root)

```text
scripts/                     # 建置資料（Node + TS）
├── sources.json             # 來源 URL、雜湊、用途清單
├── fetch-sources.ts         # 下載並核對
├── build-text.ts            # 信望愛 unv → verses、books（正規化、譯註抽出、合併節）
├── build-passages.ts        # eBible USFM 分段 → passages、units
├── build-keyword.ts         # BM25 索引
├── build-vectors.ts         # 以選定模型計算 int8 向量
└── copy-runtime.ts          # 模型檔與 ORT wasm → public/

src/
├── core/                    # 純函式；Node 與 Worker 共用
│   ├── text.ts              # searchText 正規化、譯註抽出
│   ├── refs.ts              # VerseRef/Range、overlaps、parseReference
│   ├── canon.ts             # 66 卷、約、類別
│   ├── tokenize.ts
│   ├── bm25.ts
│   ├── vectors.ts           # int8 量化、dotInt8、semanticSearch
│   ├── fusion.ts            # rrf、aggregateToPassages
│   ├── search.ts            # 組裝 SearchResponse
│   └── hit.ts               # 命中判定（評測與驗收共用）
├── embed/
│   ├── embedder.ts          # 唯一允許 import @huggingface/transformers 的檔案
│   └── env.ts               # 離線設定：localModelPath、wasmPaths、allowRemoteModels=false
├── worker/search.worker.ts
├── ui/                      # Preact 元件、strings.ts（固定介面文字）
├── pwa/                     # 下載進度、Cache Storage、storage.persist
└── main.tsx

bench/
├── queries.json
├── arms.json
├── run.ts                   # 評測主程式（Node）
└── report.json / report.md  # 產出（report 入 git，作為選擇依據）

tests/
├── unit/                    # 對應 src/core 各檔
├── property/                # fast-check 性質測試
├── acceptance/              # 7/7 驗收（Node，選定臂）
└── guards/                  # 原則 4、6 的靜態守護（掃描 src、strings、models）

e2e/                         # Playwright：離線、不外洩、措辭、篩選、出處、簡體

public/                      # 由 build:data 產生，git 忽略（data/、models/、ort/）
```

**Structure Decision**：單一前端專案。`src/core/` 為不依賴瀏覽器的純函式，同時供 Worker、評測（`bench/`）與驗收測試使用——評測與產品走同一條檢索路徑，驗收才有意義。建置腳本在 `scripts/`，產物放 `public/`，不進 git，由來源雜湊保證可重現。

## 實作順序（交給 /speckit-tasks）

1. **專案骨架與測試環境**：Vite、TS、Vitest、fast-check、ESLint 守護規則、Playwright。
2. **資料建置**：先寫正規化、合併節、譯註抽出、分段對應的測試，再寫 `scripts/`。
3. **核心檢索**：以 TDD 完成 refs → tokenize → bm25 → vectors → fusion → search → hit。
4. **評測（US3，第一個可交付檢查點）**：以 7/7 驗收測試為 Red，跑 `npm run bench` 選臂。若沒有臂達 7/7，停下來與使用者討論。
5. **UI 與 Worker**：US1、US2 → US4 展開全章 → US5 篩選。
6. **PWA 與離線**：US6，含 E2E 離線與不外洩測試。
7. **手動驗證**：quickstart 第 4 節。

## Complexity Tracking

無違反需要辯護。段落邊界來源已由使用者決定（見 Constitution Check 原則 8）。
