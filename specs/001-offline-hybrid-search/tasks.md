---
description: "離線混合檢索（全本和合本）的任務清單"
---

# Tasks：離線混合檢索（全本和合本）

**Input**：`specs/001-offline-hybrid-search/` 的設計文件
**Prerequisites**：[plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/](./contracts/)、[quickstart.md](./quickstart.md)

**Tests**：本專案規定 TDD（`.specify/memory/constitution.md`、`knowledge/principles.md` 衍生原則 7）。每個測試任務都排在它所驗證的實作任務之前；實作前必須先執行測試並**確認它因「功能尚未實作」而失敗**。

**Organization**：依使用者故事分組。執行順序依 plan.md：**US3（評測）是第一個檢查點**，通過後才做 US1、US2 的介面。

## Format：`[ID] [P?] [Story] Description`

- **[P]**：可平行（不同檔案、不依賴未完成的任務）
- **[Story]**：所屬使用者故事（US1～US6，對應 spec.md）

---

## Phase 1：Setup（共用基礎）

**Purpose**：專案初始化與工具設定

- [X] T001 建立 `package.json`：npm scripts `dev`、`build`、`preview`、`test`、`test:data`、`test:acceptance`、`lint`、`typecheck`、`e2e`、`build:data`、`bench`；相依套件固定版本 `vite@^8.3`、`vite-plugin-pwa@^1.3`、`@huggingface/transformers@4.3.0`、`preact`、`@preact/preset-vite`、`opencc-js@^1.4.2`；開發相依 `typescript@~6.0.3`、`vitest@^5`、`fast-check@^4`、`@fast-check/vitest`、`@playwright/test@^1.63`、`eslint@^10`、`typescript-eslint@^8.71`、`tsx`；執行 `npm install`
- [X] T002 [P] 建立 `tsconfig.json`：`strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitOverride`、`verbatimModuleSyntax`、`isolatedModules`、`moduleResolution: "bundler"`、`jsx: "react-jsx"`、`jsxImportSource: "preact"`
- [X] T003 [P] 建立 `vite.config.ts`（Preact preset、`worker: { format: 'es' }`、`optimizeDeps.exclude: ['@huggingface/transformers']`）與 `vitest.config.ts`（專案 `unit`＝`tests/unit/**`＋`tests/property/**`＋`tests/guards/**`，Node 環境；專案 `data`＝`tests/integration/**`，只在 `npm run test:data` 時執行；專案 `acceptance`＝`tests/acceptance/**`，只在 `npm run test:acceptance` 時執行）
- [X] T004 [P] 建立 `eslint.config.js`：typescript-eslint strict；`no-restricted-imports` 規定 `@huggingface/transformers` 只能在 `src/embed/embedder.ts` 被 import，且任何檔案都不得 import `pipeline`；`no-restricted-syntax` 禁止呼叫 `pipeline(...)`（原則 4）
- [X] T005 [P] 建立 `playwright.config.ts`：只用 Chromium 專案、`serviceWorkers: 'allow'`、`webServer` 執行 `npm run build && npm run preview`（不可用 dev server，因為 dev server 不註冊 Service Worker）
- [X] T006 [P] 更新 `.gitignore`：加入 `public/data/`、`public/models/`、`public/ort/`、`.cache/`、`test-results/`、`playwright-report/`、`dist/`
- [X] T007 [P] 依 plan.md 建立目錄骨架與進入點：`index.html`、`src/main.tsx`（空白 app）、`src/core/`、`src/embed/`、`src/worker/`、`src/ui/`、`src/pwa/`、`scripts/lib/`、`bench/`、`tests/{unit,property,integration,acceptance,guards}/`、`e2e/`；執行 `npm test`、`npm run lint`、`npm run typecheck` 確認空專案都能跑

---

## Phase 2：Foundational（所有故事的前置條件）

**Purpose**：資料建置與核心檢索純函式。US3 的評測與所有介面都走同一條檢索路徑，所以必須先完成。

**⚠️ CRITICAL**：這個階段完成前，任何使用者故事都不能開始。

### 測試（先寫、先確認失敗）

- [X] T008 [P] 在 `tests/unit/canon.test.ts` 撰寫正典測試：恰好 66 卷；創～瑪為 `OT`、太～啟為 `NT`；分類依 FR-015：律法書「創～申」、舊約歷史書「書～斯」、詩歌智慧書「伯～歌」、先知書「賽～瑪，含耶利米哀歌」、福音書「太～約」、新約歷史書「徒」、書信「羅～猶」、啟示「啟」；每卷恰屬一約一類別
- [X] T009 [P] 在 `tests/unit/refs.test.ts` 與 `tests/property/refs.prop.test.ts` 撰寫經節參照測試：VerseRef 依正典順序比較；VerseRange 滿足 `start ≤ end`；`overlaps` 對稱、自反，且與「共有至少一節」等價
- [X] T010 [P] 在 `tests/unit/text.test.ts` 撰寫經文正規化測試，涵蓋 research R1 實例：
  - `searchText` 移除 `（…）`、`【…】`、`〈…〉` 譯註，並能容錯殘缺括號（如「（倘或.」「﹞）」）
  - 移除 `─` 與「　神」前的全形空白
  - 人名間隔點 `‧` `•` `．` 統一為 `‧`
  - `display` 保留原樣
  - `notes` 取出譯註文字（如「原文是婦人」）
  - 驗證規則：「`searchText` 不得含 `（` `【` `〈` 及 `"a"` 佔位」
- [X] T011 [P] 在 `tests/unit/fhl.test.ts` 撰寫信望愛解析測試：
  - 移除 Strong's 標記 `<[^>]*>` 與 `\{[^}]*\}`
  - `txt == "a"` 的列轉為 `mergedInto` 前一節（驗證規則：「`mergedInto` 的目標必須是同章前一節」）
  - 11 節異文經節（太 18:11、23:14；可 7:16、15:28；路 17:36、23:17；約 5:4；徒 8:37、15:34、24:7、28:29）標為 `variant`
- [X] T012 [P] 在 `tests/unit/usfm.test.ts` 撰寫 USFM 分段解析測試：
  - 解析 `\c`、`\v`、`\p`、`\b`、`\m`
  - 忽略 `\s*`、`\r`、`\d` 標題（FR-011a）
  - `\v 29-30` 產生範圍
  - 每個分段標記對應到其後第一個經節
- [X] T013 [P] 在 `tests/property/passages.prop.test.ts` 撰寫段落與檢索單元的性質測試：
  - 段落是全部經節的劃分（每節恰屬一段）
  - 段落不跨章，章首一律是段落起點
  - 段落長度 ≤ `MAX_PASSAGE_VERSES = 12`
  - 檢索單元為段落內 3 節視窗、步長 2；段落 ≤ 3 節時即整段
  - 單元聯集涵蓋段落所有經節
  - 每個段落帶 `segmentation` id
- [X] T014 [P] 在 `tests/property/tokenize.prop.test.ts` 撰寫斷詞測試：輸出為字元 unigram 加 bigram；不含標點與空白；具決定性
- [X] T015 [P] 在 `tests/property/bm25.prop.test.ts` 撰寫 BM25 性質測試（contracts/search-api.md）：
  - 與單元沒有共同 token 時，該單元不出現在結果中
  - 同長度下，含完整查詢字串的單元分數 ≥ 只含部分 token 的單元
  - 結果依分數遞減排列，同分時以 id 決勝
  - 索引序列化後再讀回，查詢結果相同
- [X] T016 [P] 在 `tests/property/vectors.prop.test.ts` 撰寫向量性質測試：
  - int8 量化誤差 ≤ `scale/2` 每維
  - `dotInt8` 與 float32 內積的差距在量化誤差上界內
  - `semanticSearch` 的 topK 遞減排列、id 唯一
  - `vectors.bin` 序列化後再讀回結果相同
- [X] T017 [P] 在 `tests/property/fusion.prop.test.ts` 撰寫融合性質測試：
  - `rrf`（k=60）輸出的 id 唯一
  - 某 id 在任一輸入清單中名次提前時，它的融合名次不會變差
  - `aggregateToPassages` 輸出的 passage id 唯一，名次由該段落最高分的單元決定
- [X] T018 [P] 在 `tests/unit/hit.test.ts` 撰寫命中判定測試（FR-024）：結果段落與任一期望範圍重疊即命中；查詢在前 5 名內有任一結果命中即算命中；回傳最佳命中名次，沒有命中時為 null
- [X] T019 [P] 在 `tests/unit/search.test.ts` 以小型假資料撰寫 `search()` 測試：
  - 結果物件不含任何分數欄位（原則 6）
  - `contextRange` 為段落前後各 `CONTEXT_VERSES = 2` 節，且不跨章
  - 同一段落不重複
  - `counts` 為篩選前各約與各類別的數量
  - 篩選正確
  - 預設 `limit` 為 10（FR-003）
  - `semanticReady=false` 時只用關鍵字（FR-020）
  - 查詢超過 `MAX_QUERY_CHARS = 512` 時截斷並設 `truncated=true`
  - 空白或只有標點的查詢不搜尋
  - 關鍵字在語料中完全不存在時，仍回傳語意結果
  - 相鄰段落各自為一筆結果、不合併，同一節經文不會是兩筆結果的主體
- [X] T020 [P] 在 `tests/unit/artifacts.test.ts` 撰寫資料產物讀寫測試：`passages.bin`、`units.bin` 的 Int32 小端序格式，以及 `verses.json` 陣列格式與 `flags` 位元（1=merged、2=variant），寫入後讀回結果相同（contracts/data-artifacts.md）
- [X] T021 [P] 在 `tests/unit/fetch-verify.test.ts` 撰寫下載核對測試（以假 fetch 注入）：雜湊不符時拒絕並刪除檔案；請求帶自訂 User-Agent；快取中已有且雜湊正確時不重新下載
- [X] T022 [P] 在 `tests/integration/data-build.test.ts` 撰寫建置產物完整性測試（`npm run test:data`，在 `build:data` 之前執行必須失敗）：恰 66 卷、1,189 章、31,103 節；71 個合併節皆有 `mergedInto`；11 節異文皆標為 variant 且歸入前一節所屬段落；每節恰屬一段；產物中不含任何段落標題文字；manifest 各檔 `bytes` 與實際檔案相符

### 實作（讓上面的測試通過）

- [X] T023 [P] 在 `src/core/canon.ts` 實作 66 卷清單（id、code、short、name、testament、category），並確認 T008 通過
- [X] T024 [P] 在 `src/core/refs.ts` 實作 VerseRef／VerseRange、比較與 `overlaps`，並確認 T009 通過
- [X] T025 [P] 在 `src/core/text.ts` 實作 `toSearchText`、`extractNotes`，並確認 T010 通過（建置時與執行時共用同一函式）
- [X] T026 [P] 在 `scripts/lib/fhl.ts` 實作 `unv` 列解析（標記移除、合併節、異文標記），並確認 T011 通過
- [X] T027 [P] 在 `scripts/lib/usfm.ts` 實作分段邊界解析，並確認 T012 通過
- [X] T028 在 `src/core/passages.ts` 實作「分段邊界 → 段落 → 檢索單元」，`segmentation` 為 `cu89-paragraphs`；確認 T013 通過（依賴 T024）
- [X] T029 [P] 在 `src/core/tokenize.ts` 實作 unigram 與 bigram 斷詞，並確認 T014 通過
- [X] T030 在 `src/core/bm25.ts` 實作索引建立、序列化（`keyword.bin` 格式）與 `bm25Search`，並確認 T015 通過（依賴 T029）
- [X] T031 [P] 在 `src/core/vectors.ts` 實作 int8 量化、`vectors.bin` 讀寫、`dotInt8`、`semanticSearch`，並確認 T016 通過
- [X] T032 [P] 在 `src/core/fusion.ts` 實作 `rrf` 與 `aggregateToPassages`，並確認 T017 通過
- [X] T033 [P] 在 `src/core/hit.ts` 實作命中判定，並確認 T018 通過
- [X] T034 [P] 在 `src/core/artifacts.ts` 實作資料產物讀寫，並確認 T020 通過
- [X] T035 在 `src/core/search.ts` 實作 `search()`，組裝 `SearchResponse`（contracts/search-api.md §2），並確認 T019 通過（依賴 T024、T030～T032）
- [X] T036 建立 `scripts/sources.json`，列出各來源的 URL、sha1／sha256 與用途說明（例：「eBible：只用分段邊界，不用任何文字」）；再建立 `scripts/fetch-sources.ts` 下載並核對雜湊到 `.cache/sources/`。下載需使用自訂 User-Agent，因為 Python-urllib 的 UA 會被 403；確認 T021 通過
- [X] T037 建立 `scripts/build-text.ts`：讀取 `bible_little.db` 的 `unv` 表（先用 `node:sqlite`，不可用時改用 `better-sqlite3`），輸出 `public/data/books.<hash>.json` 與 `verses.<hash>.json`（依賴 T023、T025、T026、T034、T036）
- [X] T038 建立 `scripts/build-passages.ts`：以 eBible 分段邊界產生 `passages.<hash>.bin` 與 `units.<hash>.bin`；11 節異文經節併入其前一節所屬的段落；主控台印出段落數與單元數（依賴 T027、T028、T037）
- [X] T039 建立 `scripts/build-keyword.ts` 以產生 `keyword.<hash>.bin`，再建立 `scripts/build-data.ts` 依序串接 T036～T039，並接到 `npm run build:data`；執行後確認 T022 通過（依賴 T030、T038）

**Checkpoint**：`npm test` 全綠；`npm run build:data` 產生經文、段落、關鍵字索引，且 `npm run test:data` 全綠。

---

## Phase 3：User Story 3 — 維護者以固定查詢評測檢索品質（Priority: P1）🚦 第一個檢查點

**Goal**：以固定查詢比較候選 embedding 方案，選出符合 7/7 且下載量 ≤ 200 MB 的方案。

**Independent Test**：`npm run bench` 產出 `bench/report.md`；重跑後 `bench/report.json` 不變；`npm run test:acceptance` 7/7。

### 測試（先寫、先確認失敗）

- [X] T040 [P] [US3] 在 `tests/acceptance/benchmark.test.ts` 撰寫驗收測試：讀取 `public/data/manifest.json` 選定的臂，以完整混合檢索跑 `bench/queries.json` 中 `heldOut: false` 的 7 筆查詢，斷言 7 筆全部命中。尚未有資料與模型時，這個測試必須失敗（Red）
- [X] T041 [P] [US3] 在 `tests/unit/bench-select.test.ts` 撰寫選擇規則與報告測試（research R3）：
  - 選擇順序：大小 ≤ 200 MB → 命中數最高 → 平均最佳名次較佳 → 較小者
  - 報告不含時間戳記，同一輸入序列化後逐位元相同
  - 沒有任何臂達到 7/7 時，`selected` 為 null 並回報原因
- [X] T042 [P] [US3] 在 `tests/unit/embedder.test.ts` 撰寫 embedder 設定測試（以假模型注入）：`queryPrefix` 只加在查詢端；`toSimplified` 只影響送進模型的文字；pooling 依設定使用 CLS 或 mean；輸出經過 L2 正規化
- [X] T043 [P] [US3] 在 `tests/guards/models-dir.test.ts` 撰寫守護測試：`public/models/` 只含 manifest 指定的那一個 embedding 模型檔案組（原則 4）
- [X] T044 [P] [US3] 在 `tests/unit/fetch-models.test.ts` 撰寫模型下載測試（以假 fetch 注入）：URL 使用 `bench/arms.json` 的固定 revision；每個檔案核對 sha256，不符時拒絕
- [X] T045 [P] [US3] 在 `tests/unit/manifest.test.ts` 撰寫 manifest 產生測試：依 report 的 `selected` 臂寫入 `model`（id、revision、dtype、dim、pooling、queryPrefix、toSimplified）與 `segmentation`；各檔 `bytes` 與雜湊檔名正確；`selected` 為 null 時拋出錯誤

### 實作

- [X] T046 [P] [US3] 建立 `bench/queries.json`：7 筆驗收查詢（與 `knowledge/vision.md` 階段 1、data-model 的表格一致），另加 5～8 筆 `heldOut: true` 的保留查詢；經文以信望愛 `engs` 代碼加 `章:節` 表示
- [X] T047 [P] [US3] 建立 `bench/arms.json` 並固定 HF revision。要包含的臂：
  - `Xenova/bge-small-zh-v1.5`：繁體、繁體＋查詢指令、轉簡體
  - `onnx-community/granite-embedding-97m-multilingual-r2`：繁體、轉簡體
  - `Xenova/jina-embeddings-v2-base-zh`：繁體、轉簡體
  - `onnx-community/gte-multilingual-base`：只作品質上限參考，標記 `oversize: true`
- [X] T048 [US3] 建立 `scripts/fetch-models.ts`：依 `bench/arms.json` 下載每個模型在固定 revision 的 `config.json`、`tokenizer*.json`、`onnx/model_quantized.onnx` 到 `.cache/models/`，並核對 sha256；確認 T044 通過
- [X] T049 [US3] 在 `src/embed/embedder.ts` 實作 embedder，並確認 T042 通過：
  - 這是唯一 import `@huggingface/transformers` 的檔案，只用 `AutoTokenizer` 與 `AutoModel`，不用 `pipeline`
  - 支援 `pooling`、`queryPrefix`、`toSimplified`（`opencc-js/t2cn`，`{from:'tw', to:'cn'}`，逐字轉換）
  - Node 與瀏覽器共用
  - `toSimplified=true` 時，轉換器在 embedder 初始化時載入（不是延遲載入）
- [X] T050 [US3] 在 `src/embed/env.ts` 實作離線設定：`allowRemoteModels = false`、`allowLocalModels = true`、`localModelPath`、`backends.onnx.wasm.wasmPaths = '/ort/'`；Node 端以 `.cache/models/` 為模型路徑
- [X] T051 [US3] 建立 `scripts/build-vectors.ts`：以指定臂的模型在 Node 計算所有檢索單元的 int8 向量，輸出到 `.cache/bench/<armId>/vectors.bin`；批次大小 32（依賴 T031、T038、T049）
- [X] T052 [US3] 在 `bench/run.ts` 實作評測主程式：對每個臂建立向量後，以 `src/core/search.ts` 跑全部查詢，輸出 `bench/report.json` 與 `bench/report.md`（格式見 contracts/benchmark.md），並依選擇規則標示選中的臂；`report.md` 另附每臂在 Node 上的 `search()` 延遲中位數（僅供參考，不寫入 report.json）；確認 T041 通過（依賴 T033、T035、T051）
- [X] T053 [US3] 建立 `scripts/write-manifest.ts`：依 `bench/report.json` 選中的臂，把該臂的向量複製成 `public/data/vectors.<hash>.bin`、模型檔複製到 `public/models/`，並寫出 `public/data/manifest.json`（含 `model`、`segmentation`、`sources`）；若選中轉簡體的臂，一併準備 `opencc-js/t2cn` 轉換器隨模型預先下載（research R6 例外）；確認 T043、T045 通過
### 檢查點未過後的調整（2026-10-01，research R9–R11、history/003、衍生原則 9）

第一次評測（`bench/report.md`）最多 3/7。使用者決定：加入多尺度檢索、辭典近義詞＋原文同字擴充、署名；需要詮釋的查詢由使用者換說法，不由工具處理。

#### 測試（先寫、先確認失敗）

- [X] T054 [P] [US3] 在 `tests/property/passages.prop.test.ts` 增補多尺度檢索單元的性質測試：單節單元涵蓋每一個非合併佔位的經節、且排在所有單元最前面（id 0..V-1，關鍵字索引的文件 id 即單元 id）；視窗單元規則不變；整段單元只為 > 3 節的段落建立；每個單元帶 `scale`
- [X] T055 [P] [US3] 在 `tests/unit/artifacts.test.ts` 增補 `units.bin` 第四欄 `scale`（0／1／2）的讀寫測試
- [X] T056 [P] [US3] 在 `tests/unit/lexicon-build.test.ts` 撰寫詞彙表建置測試（以小型假資料）：萌典近義詞只保留在和合本中出現的詞；Strong's 分組去除包含較短片段的長片段（如「用思慮」→ 保留「思慮」）；擴充只有一層辭典＋一層原文、不遞迴；每個擴充詞帶來源（`moedict` 或 `strongs:Gxxxx`／`strongs:Hxxxx`）
- [X] T057 [P] [US3] 在 `tests/unit/expand.test.ts` 撰寫查詢擴充測試：以最長匹配在查詢中找出詞表中的詞；「面對房貸壓力很焦慮」擴充出「憂慮」（moedict）與「掛慮」（strongs）；擴充詞已在查詢中出現時不重複；`expand: false` 時不擴充
- [X] T058 [P] [US3] 在 `tests/unit/search.test.ts` 增補：`granularity` 為 `verse`／`passage`／`chapter` 時結果範圍分別為單節／段落／整章且皆附上下文；`expansions` 欄位列出實際套用的擴充與來源；擴充命中的結果 `sources` 含 `expansion`

#### 實作

- [X] T059 [US3] 在 `src/core/passages.ts` 實作多尺度 `buildUnits`（單節在前、視窗、整段），在 `src/core/artifacts.ts` 加入 `scale` 欄；確認 T054、T055 通過
- [X] T060 [US3] 建立 `scripts/build-lexicon.ts`：下載萌典 `dict-revised.json.xz`（核對雜湊，加入 `scripts/sources.json` 並註明 CC BY-ND 3.0 TW、只取近義關係）、從信望愛 `unv` 的 Strong's 標記建立同字譯法分組，輸出 `public/data/lexicon.<hash>.json`；確認 T056 通過
- [X] T061 [US3] 在 `src/core/expand.ts` 實作 `expandQuery`，並在 `src/core/search.ts` 加入擴充清單（獨立 RRF 清單）、`granularity` 聚合與 `expansions` 回應欄位；關鍵字索引改建在單節單元上；確認 T057、T058 通過
- [X] T062 [US3] 更新 `scripts/build-data.ts`、`scripts/build-keyword.ts`、`bench/lib.ts`、`scripts/build-vectors.ts` 以使用多尺度單元與詞彙表；重跑 `npm run build:data` 並確認 `npm run test:data` 通過
- [X] T063 [US3] 依 history/003 更新 `bench/queries.json`（「討好所有人」加列加 1:10、帖前 2:4；「被親近的人操控」改為「被最親近的朋友背叛、出賣」）—— 已與 `knowledge/vision.md` 同步

- [ ] T064 [US3] 執行 `npm run bench`，連跑兩次並確認 `git diff --exit-code bench/report.json`；接著執行 `npm run test:acceptance`，確認 T040 轉綠；最後 commit `bench/report.json` 與 `bench/report.md`。**若沒有任何臂達到 7/7：停止後續所有任務，帶著報告與使用者討論（research R3 第 3 條）**

**Checkpoint**：已選定模型且驗收 7/7。之後才開始做介面。

---

## Phase 4：User Story 1 — 用日常語言找到相關經文段落（Priority: P1）🎯 MVP

**Goal**：使用者輸入口語描述，看到以段落呈現、標示出處的「可能相關的段落」。

**Independent Test**：在瀏覽器輸入 4 個意思型固定查詢，期望經文都出現在前 5 筆；畫面上沒有任何生成文字或分數。

### 測試（先寫、先確認失敗）

- [ ] T065 [P] [US1] 在 `tests/guards/no-generation.test.ts` 撰寫守護測試：掃描 `src/**`，不得出現 `text-generation`、`text2text`、`AutoModelForCausalLM`、`Seq2Seq`、`pipeline(`（原則 4）
- [ ] T066 [P] [US1] 在 `tests/guards/strings.test.ts` 撰寫守護測試：`src/ui/strings.ts` 不得含「最佳」「推薦」「最正確」「答案」「解釋」「建議」；結果區標題為「可能相關的段落」（FR-014）
- [ ] T067 [P] [US1] 在 `tests/unit/worker-protocol.test.ts` 撰寫 Worker 協定測試：`init`、`progress`、`ready`、`search`、`result`、`error` 各訊息的形狀與 id 對應；`error.code` 只能是 `NOT_DOWNLOADED`、`QUOTA`、`CORRUPT`、`INTERNAL` 之一（contracts/search-api.md §3）
- [ ] T068 [P] [US1] 在 `e2e/search-meaning.spec.ts` 撰寫 E2E：
  - 對 4 個意思型固定查詢，斷言期望經文出現在前 5 筆
  - 每筆結果顯示卷、章、節範圍與約／類別
  - 沒有孤立單節（SC-006）
  - 畫面無數值分數
  - 結果區標題為「可能相關的段落」
  - 預設顯示 10 筆，按「載入更多」後顯示後續結果且不重複（FR-003）
  - 可在「節／段／章」之間切換，切換後結果範圍隨之改變且皆附上下文（FR-026）
  - 「焦慮」類查詢顯示「也比對了：…」與來源，且可關閉擴充（FR-027）
  - 結果區顯示段落邊界、辭典、原文分組的來源署名（FR-028）與「可以換個說法」提示（FR-029）

### 實作

- [ ] T069 [US1] 在 `src/worker/search.worker.ts` 實作 Worker：
  - 依 manifest 載入經文、段落、單元、關鍵字索引、向量與模型
  - 以 `progress` 回報進度
  - 處理 `search` 訊息，呼叫 `src/core/search.ts`
  - 只向同源請求 `/data/`、`/models/`、`/ort/`
- [ ] T070 [P] [US1] 在 `src/worker/client.ts` 實作型別化的 Worker 用戶端（`postMessage` 加上請求 id 對應），並確認 T067 通過
- [ ] T071 [P] [US1] 建立 `src/ui/strings.ts`，集中所有固定介面文字；確認 T066 通過
- [ ] T072 [P] [US1] 在 `src/ui/SearchBox.tsx` 實作搜尋框：空白或只有標點的查詢不送出並顯示提示；查詢被截斷時顯示提示
- [ ] T073 [P] [US1] 在 `src/ui/PassageCard.tsx` 實作段落卡片：
  - 顯示 `display` 經文，保留「　神」
  - 譯註以次要樣式呈現
  - 前後文以淡色呈現
  - 標示卷章節範圍與約／類別
  - 不顯示分數
- [ ] T074 [US1] 在 `src/ui/ResultList.tsx` 與 `src/main.tsx` 組裝頁面：顯示「可能相關的段落」清單，預設 10 筆，可「載入更多」；確認 T065、T068 通過
- [ ] T075 [P] [US1] 在 `src/ui/GranularityToggle.tsx`、`src/ui/ExpansionNote.tsx`、`src/ui/Attribution.tsx` 實作粒度切換、擴充列示（含關閉擴充）、來源署名與換說法提示，接入 `src/ui/ResultList.tsx`；確認 T068 中對應的斷言通過

**Checkpoint**：MVP。口語查詢可用，且符合原則 4、5、6。

---

## Phase 5：User Story 2 — 用人名、地名或精確詞句找到經文（Priority: P1）

**Goal**：關鍵字、出處、簡體輸入都能精確命中，命中字詞會被標示。

**Independent Test**：「迦拿的婚宴」、「麥基洗德」、「大衛擊殺歌利亞」的期望經文都出現在前 5 筆；「羅 8:28」為第 1 筆；「麦基洗德」與「麥基洗德」的結果相同。

### 測試（先寫、先確認失敗）

- [ ] T076 [P] [US2] 在 `tests/unit/parse-reference.test.ts` 撰寫出處解析測試：
  - 可解析「羅 8:28」、「羅馬書8章28節」、「羅8:28-30」、「約一 1:9」
  - 66 卷的全名與簡稱都能解析
  - 章或節不存在時回傳 null
  - 出處查詢時，該段落為第 1 筆（FR-004）
- [ ] T077 [P] [US2] 在 `tests/unit/normalize.test.ts` 撰寫查詢正規化測試：
  - 能偵測簡體字，並以 `opencc-js` 的 `cn2t`（`{from:'cn', to:'tw'}`，逐字轉換）將「麦基洗德」轉為「麥基洗德」
  - 不含簡體字時不載入轉換器
  - 統一全形與半形（FR-005）
- [ ] T078 [P] [US2] 在 `tests/unit/matched-terms.test.ts` 撰寫命中字詞測試：`matchedTerms` 只列出查詢中實際出現在段落的字詞；標示範圍不會切斷字元（FR-006）
- [ ] T079 [P] [US2] 在 `e2e/search-keyword.spec.ts` 撰寫 E2E：
  - 3 個關鍵字固定查詢都命中前 5 筆
  - 「羅 8:28」為第 1 筆
  - 簡體與繁體輸入的結果相同
  - 命中字詞有被標示

### 實作

- [ ] T080 [US2] 在 `src/core/refs.ts` 實作 `parseReference`（全名、簡稱、`章:節`、`章章節節`、範圍），並在 `src/core/search.ts` 中讓出處段落排第 1；確認 T076 通過
- [ ] T081 [P] [US2] 在 `src/core/normalize.ts` 與 `src/core/simplified.ts` 實作查詢正規化，簡轉繁的轉換器用動態 import 延遲載入；確認 T077 通過
- [ ] T082 [US2] 在 `src/core/search.ts` 計算 `matchedTerms`，並在 `src/ui/PassageCard.tsx` 標示命中字詞；確認 T078、T079 通過

**Checkpoint**：混合檢索完整；spec 的 7 個固定查詢都能在瀏覽器中驗證。

---

## Phase 6：User Story 4 — 從結果展開上下文與全章（Priority: P2）

**Goal**：一鍵展開全章並定位到命中段落；複製內容附上出處。

**Independent Test**：對任一結果展開全章，畫面位於命中段落且該段落有標示；複製後貼上的內容含卷章節範圍。

### 測試（先寫、先確認失敗）

- [ ] T083 [P] [US4] 在 `tests/unit/copy.test.ts` 撰寫複製格式測試：內容為段落經文加出處（如「約翰福音 2:1–11」）；不含系統產生的文字（FR-011）
- [ ] T084 [P] [US4] 在 `tests/unit/chapter.test.ts` 撰寫全章資料測試：Worker 的 `chapter` 訊息回傳該章所有經節與段落；合併節顯示為範圍；不含標題（FR-011a）
- [ ] T085 [P] [US4] 在 `e2e/expand-chapter.spec.ts` 撰寫 E2E：展開全章後顯示該章所有經文，命中段落有標示且位於視窗中；可收合回結果清單

### 實作

- [ ] T086 [US4] 在 `src/worker/search.worker.ts` 處理 `chapter` 與 `chapterResult` 訊息；確認 T084 通過
- [ ] T087 [P] [US4] 在 `src/ui/copy.ts` 實作附出處的複製功能；確認 T083 通過
- [ ] T088 [US4] 在 `src/ui/ChapterView.tsx` 實作全章檢視（標示命中段落、捲動到該段、收合），並接到 `PassageCard` 的「展開全章」；確認 T085 通過

---

## Phase 7：User Story 5 — 依正典分類篩選結果（Priority: P2）

**Goal**：可依舊約／新約，或一個／多個類別篩選，並顯示各約與各類別的結果數量。

**Independent Test**：選「舊約」後，所有結果都屬於舊約；數量標示正確；篩選無結果時顯示中性訊息，且可一鍵清除篩選。

### 測試（先寫、先確認失敗）

- [ ] T089 [P] [US5] 在 `tests/unit/filter.test.ts` 撰寫篩選測試：以 `(testament, category)` 為鍵，所以舊約歷史書與新約歷史書可以分開選取；選整個約等於選該約所有類別；`counts` 為篩選前的數量（FR-016）
- [ ] T090 [P] [US5] 在 `e2e/filter.spec.ts` 撰寫 E2E：
  - 選「書信」後，每筆結果都來自書信
  - 選「舊約」後，每筆結果都來自舊約，且可再細分類別
  - 數量標示正確
  - 沒有結果時顯示「此分類沒有相關段落」並可清除篩選

### 實作

- [ ] T091 [US5] 在 `src/core/search.ts` 補上 `filter` 與 `counts` 的邊界情況；確認 T089 通過
- [ ] T092 [US5] 在 `src/ui/FilterBar.tsx` 實作兩層篩選列（約 → 類別，附數量），以及空結果訊息與清除按鈕；確認 T090 通過

---

## Phase 8：User Story 6 — 離線且不外洩地使用（Priority: P2）

**Goal**：首次載入時顯示下載進度，之後完全離線；查詢不會離開裝置。

**Independent Test**：先暖機，再關閉伺服器並設為離線，重新載入後所有功能可用；搜尋期間所有請求都同源，且沒有任何請求含查詢內容。

### 測試（先寫、先確認失敗）

- [ ] T093 [P] [US6] 在 `tests/unit/download.test.ts` 撰寫下載測試：
  - 依 `Content-Length` 與串流計算進度
  - 以有版本號的 Cache Storage 名稱存放
  - 雜湊檔名更新時整批替換
  - `QuotaExceededError` 轉為 `QUOTA` 錯誤
- [ ] T094 [P] [US6] 在 `e2e/first-load.spec.ts` 撰寫 E2E：
  - 首次開啟時顯示下載進度，完成後顯示「已可離線使用」（FR-019）
  - 模型就緒前可用關鍵字搜尋，並顯示「語意搜尋準備中」
  - 模型就緒後，畫面上的查詢會自動更新為混合結果（FR-020）
- [ ] T095 [P] [US6] 在 `e2e/offline.spec.ts` 撰寫 E2E（SC-002）：
  - 在測試中自行啟動 preview server，等 `navigator.serviceWorker.ready` 與「已可離線使用」
  - **關閉伺服器**並執行 `context.setOffline(true)`，重新載入
  - 驗證搜尋、展開全章、篩選都可用
  - 這個測試不得使用 `route()`
- [ ] T096 [P] [US6] 在 `e2e/privacy.spec.ts` 撰寫 E2E（SC-003）：
  - 在導航前掛上 `context.on('request')`（不可呼叫 `request.frame()`）與 `page.on('websocket')`
  - 以「以馬內利測試」搜尋
  - 斷言所有請求都同源
  - 斷言沒有任何請求的 URL、POST 內容或標頭含查詢字串，包括它的 URL 編碼、簡體與繁體形式
- [ ] T097 [P] [US6] 在 `e2e/not-downloaded.spec.ts` 撰寫 E2E：從未下載過又沒有網路時，顯示「需要先連網完成一次下載」的說明
- [ ] T098 [P] [US6] 在 `e2e/storage-cleared.spec.ts` 撰寫 E2E：完成首次載入後以程式清除 Cache Storage；有網路時重新開啟會重新下載並顯示進度；無網路時顯示「需要重新下載」的說明
- [ ] T099 [P] [US6] 在 `tests/unit/copy-runtime.test.ts` 撰寫測試：複製的 onnxruntime-web 版本等於 `@huggingface/transformers` 所相依的版本；只複製 `.wasm` 與 `.mjs`
- [ ] T100 [P] [US6] 在 `tests/guards/download-size.test.ts` 撰寫守護測試（在 `npm run build` 之後執行）：首次下載總量＝manifest 所列檔案＋`public/models/`＋`public/ort/`＋`dist/` app shell（若 `toSimplified=true` 再加 t2cn 轉換器）≤ 200 MB（SC-005、plan Constraints）

### 實作

- [ ] T101 [US6] 建立 `scripts/copy-runtime.ts`：把 `onnxruntime-web` 的 `.wasm` 與 `.mjs` 複製到 `public/ort/`，版本須與 `@huggingface/transformers` 的相依一致；接進 `npm run build:data`；確認 T099 通過
- [ ] T102 [US6] 在 `vite.config.ts` 設定 vite-plugin-pwa：
  - precache app shell 與 `public/data/` 中除了 `vectors.*` 以外的檔案
  - `runtimeCaching` 以 `CacheFirst` 處理 `/models/**`、`/ort/**`、`/data/vectors.*`
  - 調整 `maximumFileSizeToCacheInBytes`
  - 補上 manifest（名稱 BibLexer、繁體中文）
- [ ] T103 [US6] 在 `src/pwa/download.ts` 實作模型與向量的串流下載：回報進度、存入有版本號的 Cache Storage、成功後呼叫 `navigator.storage.persist()`；確認 T093 通過
- [ ] T104 [US6] 在 `src/ui/ProgressBanner.tsx` 實作載入狀態 UI，狀態依 data-model 的載入狀態轉換（未安裝 → 關鍵字可用 → 完全就緒；未下載又離線時顯示說明）；提示使用者安裝到主畫面以避免被瀏覽器清除；確認 T094、T097、T098 通過
- [ ] T105 [US6] 執行 `npm run build` 與 `npm run e2e`，確認 T095、T096、T100 通過。若發現對外請求（例如 jsdelivr 或 Hugging Face），修正 `src/embed/env.ts` 或快取設定，不可放寬測試

---

## Phase 9：Polish 與跨切面

- [ ] T106 [P] 撰寫 `README.md`（繁體中文）：專案用途、「工具只指路，不代言」的定位、建置與測試指令（連到 quickstart.md）
- [ ] T107 [P] 撰寫 `docs/資料來源.md`：由 `scripts/sources.json` 整理出經文、分段邊界、模型、ONNX Runtime 各自的來源、版本、用途與授權現況，並標出使用了哪些非經文本身的資料（分段邊界），供使用者與信望愛溝通時使用
- [ ] T108 依 quickstart.md 第 4 節在 iPhone（Safari，加入主畫面）與 Android（Chrome）**各一台**做手動驗證（SC-004、SC-005、SC-009），把結果記錄在 `specs/001-offline-hybrid-search/manual-verification.md`
- [ ] T109 完整執行 quickstart.md 第 1～3 節（`build:data`、`bench`、`test`、`test:data`、`test:acceptance`、`lint`、`typecheck`、`e2e`），全部通過
- [ ] T110 知識回流：
  - 更新 `knowledge/vision.md` 的「現狀」與階段 1 勾選框（標完成日期）；把「腓 4:6 附近」改為與 spec 一致的重疊定義
  - 實作中的教訓依四段式寫進 `knowledge/experience.md`
  - `knowledge/draft/2026-09-30-前端檢索技術選型.md` 已定案的部分依 knowie 的「分派」原則移出

---

## Dependencies & Execution Order

### 階段依賴

- **Setup（Phase 1）** → **Foundational（Phase 2）** → **US3 評測（Phase 3，檢查點）** → 其餘故事
- **US1（Phase 4）**：依賴 US3 選定的模型（manifest）
- **US2（Phase 5）**：依賴 US1 的 Worker 與 UI 骨架（T069～T074）
- **US4、US5（Phase 6、7）**：依賴 US1；兩者可平行
- **US6（Phase 8）**：依賴 US1；可與 US2、US4、US5 平行（主要改動在 `vite.config.ts`、`src/pwa/`、`src/embed/env.ts`）
- **Polish（Phase 9）**：所有故事完成後

### 故事內部

- 測試 → 確認失敗 → 實作 → 確認通過
- core 純函式先於 Worker，Worker 先於 UI

### 關鍵路徑

T001 → T007 → Phase 2 測試 → T023～T035 → T036～T039 → T040～T064（評測檢查點）→ T069 → T074 → 其餘故事

---

## Parallel Examples

### Phase 2 測試（全部可平行）

```text
T008 canon、T009 refs、T010 text、T011 fhl、T012 usfm、T013 passages、
T014 tokenize、T015 bm25、T016 vectors、T017 fusion、T018 hit、T019 search、T020 artifacts、T021 下載核對、T022 產物完整性
```

### Phase 2 實作（可平行的一組）

```text
T023 canon、T024 refs、T025 text、T026 fhl、T027 usfm、T029 tokenize、
T031 vectors、T032 fusion、T033 hit、T034 artifacts
```

### US3

```text
平行：T040 驗收、T041 選擇規則、T042 embedder、T043 models 守護、T044 模型下載、T045 manifest、T046 queries、T047 arms
依序：T048 → T049 → T050 → T051 → T052 → T053 → T064
```

### US1

```text
平行：T065、T066、T067、T068（測試）；T070、T071、T072、T073（實作）
依序：T069 → T074
```

### US4 與 US5 可由不同人同時進行；US6 的測試 T093～T097、T098～T100 可全部平行

---

## Implementation Strategy

### 先過檢查點，再做 MVP

1. Phase 1 → Phase 2：資料與核心檢索（`npm test` 全綠）
2. **Phase 3（US3）**：評測選模型，驗收 7/7。**沒達到 7/7 就停下來與使用者討論**，不做介面
3. Phase 4（US1）：**MVP**，口語查詢可在瀏覽器使用
4. **停下來驗證**：用 4 個意思型查詢實際操作

### 漸進交付

- US2：關鍵字、出處、簡體 → 7 個固定查詢都可在瀏覽器驗證
- US4 ＋ US5：上下文與篩選
- US6：離線與隱私 → 可以拿給信望愛看的版本
- Polish：資料來源說明、手動驗證、知識回流

### 注意

- [P] 任務＝不同檔案、沒有未完成的依賴
- 每個任務完成就 commit
- 驗收失敗時修正實作，不可放寬測試
