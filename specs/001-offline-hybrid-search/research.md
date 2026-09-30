# Phase 0 研究：離線混合檢索

**日期**：2026-09-30 ｜ **Spec**：[spec.md](./spec.md)

三項研究同時進行（資料來源、embedding 模型、前端與測試工具鏈）。下列「已驗證」指實際抓取、執行或讀過原始碼／官方文件；「推測」另行標註。

---

## R1. 經文來源：信望愛 `unv`（和合本神版）

**Decision**：建置時下載信望愛整本資料庫 `http://ftp.fhl.net/FHL/COBS/data/bible_little.zip`（約 8 MB，內含 SQLite `bible_little.db`），核對 sha1 後讀取 `unv` 表，移除 Strong's 標記（`<[^>]*>`、`\{[^}]*\}`）取得經文。JSON API（`bible.fhl.net/json/qb.php`）只用於抽樣核對。

**Rationale**：
- 已驗證：`unv` 即「FHL和合本」，為**神版**——「　神」前有全形空白，全書 0 處「上帝」。
- 已驗證：`unv` 標示可下載（`abv.php` 的 `candownload:1`）；一次下載可免去 1,189 次章節 API 呼叫。
- 用 `unv`（帶標記）而非 `nstrunv`（純文字），因為只有前者保留「　神」的抬頭空白（神版排版）。

**必須處理的資料特性**（已驗證）：

| 特性 | 數量 | 處理 |
|---|---|---|
| 合併經節佔位：經文字面為 `"a"`（如創 24:30，內容併入 24:29） | 71 處 | 不索引 `"a"`；記為前一節的範圍延伸（如「創 24:29–30」） |
| 括號內容：共 1,383 處（）加上【】、〈〉。**實作時查證**：只有約一半是譯者註（以「或譯」「原文」「或作」「有古卷」開頭，約 726 處），另一半是經文本身（詩篇標題、「細拉」、敘事旁白、〈…〉） | — | 只把譯者註（上述四種開頭的（…）與全部【…】）抽出為譯註欄位、不進檢索；經文本身的括號內容保留在檢索文字中，只去掉括號符號；顯示時譯註以次要樣式呈現；殘缺括號需容錯 |
| 異文經節（太 18:11、可 7:16、徒 8:37 等） | 11 節 | 保留並標記 |
| 人名間隔點 `‧` `•` `．` 三種 | 約 470 節 | 統一為 `‧` |
| 連接號 `─`（「耶和華─你們的神」） | 1,190 節 | 顯示保留；檢索文字移除 |
| 經節總數 | 31,103 | 約 7:53 併入 8:1；另有約三 1:15、啟 12:18 |

**授權現況**（已驗證，交由使用者與信望愛確認）：
- API 說明：「有些僅授權給信望愛站使用，請查閱版權說明…請勿任意使用」。
- 下載目錄的 LICENCE：「這個資料庫是CBOL計畫的測試用資料，僅作為測試用途，請勿使用來作為任何正式的聖經查詢用途」。
- `unv` 來源：信望愛依已過著作權保護期的 1919 年和合本打字（1995），加上信望愛自己的標點；Strong's 編號屬信望愛（FDL），本專案不使用 Strong's 標記。
- 依使用者指示（`knowledge/draft/2026-09-30-前端檢索技術選型.md`）：授權確認不阻擋開發，但須記錄用到的非經文資料。

**Alternatives considered**：
- 逐章呼叫 JSON API：1,189 次請求；且書名錯誤時會**默默回傳羅馬書**（已驗證），風險高。
- `cumv`（官話和合本）：是**上帝版**，不符合決定。
- `rcuv`（和合本 2010）：僅授權信望愛站使用。

---

## R2. 段落邊界：eBible 新標點和合本（神版）的分段標記

**Decision**：從 eBible.org 的 `cmn-cu89s_usfm.zip`（新標點和合本，簡體、神版，eBible 標示為 Public Domain）解析 `\p`、`\b`、`\m` 分段標記，對應到下一個經節，得到段落起點；**丟棄**所有標題標記（`\s`、`\r`、`\d`）。只取邊界，不取任何文字。

**Rationale**：
- 已驗證：信望愛 `unv` 完全沒有分段資料。
- 已驗證：eBible 繁體版（cu89t）為上帝版，簡體版（cu89s）為神版；兩者分段完全相同（約翰福音都是 119 個 `\p`）。只用邊界，所以簡繁不影響。
- 已驗證：eBible 的經節是信望愛的嚴格子集；信望愛多出的 11 節異文經節需手動歸入所屬段落；eBible 的 `\v 29-30` 合併節對應信望愛的 `"a"` 佔位。
- 全書約 5,996 個段落起點，平均約 5 節一段——與 spec 的「段落」單位吻合。

**神學準則檢查**（`knowledge/concepts/西敏神學院傳統是設計準則.md`）：分段本身也是編者的判斷，但比標題弱得多——它不告訴讀者「這段在講什麼」，只決定結果以多長的範圍呈現；且讀者一鍵即可展開全章（原則 5）。因此採用分段、不採用標題。此點列入 plan 的 Constitution Check 供使用者確認。

**授權**：eBible 標示 Public Domain；但新標點和合本（1988，香港聖經公會）的標點與分段是否屬公有領域有灰色地帶（推測）。只使用邊界（不含任何文字），記錄於資料來源清單。

**Alternatives considered**：
- `cumv` 的「○」段落記號：較接近 1919 原版，但稀疏（約翰福音 30 個 vs 分段 119 個），只能逐章 API 抓取且未標示可下載。保留為日後可選的第二層訊號。
- 固定視窗（每 N 節一段）：不需外部資料，但會把段落從中切斷，違背「上下文優先」的精神。作為極長段落（如詩 119）的補充切法。

---

## R3. Embedding 候選模型與評測設計

**Decision**：以固定查詢集評測下列候選（皆有 transformers.js 可用的 ONNX、授權可商用）：

| 候選 | ONNX（q8） | 維度 | Pooling／前綴 | 授權 | C-MTEB 檢索 |
|---|---|---|---|---|---|
| `Xenova/bge-small-zh-v1.5` | 24 MB | 512 | CLS；查詢可選加指令 | MIT | 61.77 |
| `onnx-community/granite-embedding-97m-multilingual-r2`（2026） | 98 MB | 384 | CLS；無 | Apache-2.0 | 未公布 |
| `Xenova/jina-embeddings-v2-base-zh` | 161 MB | 768 | mean；無 | Apache-2.0 | 69.40 |
| `onnx-community/gte-multilingual-base` | 340 MB | 768 | CLS；無 | Apache-2.0 | 71.95 |

評測臂（arms）：每個模型 ×「繁體原文」／「embedding 前轉簡體（OpenCC tw→cn，只影響向量，不影響顯示）」；bge-small 另加「有／無查詢指令」。

**選擇規則**（寫進評測程式，可重現）：
1. 首次載入總下載量 MUST ≤ 200 MB（由 SC-005「20 Mbps 下 2 分鐘」推得：2.5 MB/s × 120 s ≈ 300 MB，保留餘裕給其他資源與慢速網路）。→ gte-multilingual-base（340 MB）列為**品質上限參考**，不作為候選交付。
2. 在符合大小限制的臂中，取固定查詢**命中數最高**者；同分取**平均最佳名次較佳**者；再同分取**較小**者。
3. 若沒有任何臂達到 7/7，不進入 UI 開發，回報結果並與使用者討論（加大模型、調整切塊或擴充查詢集）。

**Rationale**：
- 已驗證：所有候選的 tokenizer 對和合本繁體文字都是 0 個未知 token。
- 已驗證（小規模試驗，僅 12 節 × 5 查詢，不具統計意義）：「面對房貸壓力很焦慮」在多數模型都把腓 4:6 等排在第 1–2 名；轉簡體對部分模型有幫助、對部分有害——所以做成評測臂而不是預先決定。
- 已驗證：同一個 `.onnx` 在 onnxruntime-node 與 onnxruntime-web（WASM）產生的向量幾乎相同（最大絕對差 9e-8）→ **建置時在 Node 用同一模型檔預先計算經文向量**，查詢在瀏覽器計算，兩邊一致。
- 已驗證（Node、M3 CPU、q8）：2 萬短段落約 1–8 分鐘（依模型），建置可接受。

**風險**：7 個查詢很少，選模型時有過度貼合（overfit）的風險。評測報告會同時列出各臂在「保留查詢」（評測時另寫、不用於選擇的一小組查詢）上的表現作為參考；驗收仍以 spec 的 7 個固定查詢為準。

**Alternatives considered**：
- bge-m3（569 MB）、Qwen3-Embedding-0.6B（614 MB）：太大。
- jina-embeddings-v5-nano：CC-BY-NC，排除。
- EmbeddingGemma-300m：Gemma 授權、速度慢，排除。
- Python sentence-transformers 建置：fp32 PyTorch 與瀏覽器的 q8 ONNX 會不一致，排除。

---

## R4. 向量儲存與相似度搜尋

**Decision**：向量以 int8 儲存（每向量一個縮放係數），瀏覽器端在 Web Worker 中對全部檢索單元做暴力內積；查詢向量為 float32。

**Rationale**：已驗證（HF Embedding Quantization）：int8 保留約 99.3% 檢索效能；2 萬 × 512 維的 int8 約 10 MB。2 萬次內積在 JS 為毫秒級。二元量化在小模型上損失較大，不採用。

---

## R5. 關鍵字檢索：自製字元 bigram BM25

**Decision**：自行實作 BM25（字元 bigram＋unigram），索引在建置時產生為緊湊的型別陣列；瀏覽器只做查詢。不使用 MiniSearch／FlexSearch／Orama。

**Rationale**：
- 已驗證：MiniSearch 預設以空白與標點斷詞，中文需覆寫 tokenizer；FlexSearch 的 CJK 設定不是 BM25；Orama 的中文 tokenizer 為斷詞。
- 語料固定（約 3 萬節），自製約 100–150 行、可決定性、容易做性質測試（例：無共同 bigram 時分數為 0；含完整查詢的段落排名不低於部分符合者）。
- unigram 讓「愛」這類單字查詢也能命中。

**混合融合**：Reciprocal Rank Fusion（RRF），`score = Σ 1/(k + rank)`，k = 60；語意與關鍵字各取前 100 個檢索單元，融合後聚合到段落（同一段落取最高分，去重）。

---

## R6. 簡體輸入

**Decision**：`opencc-js`（MIT AND Apache-2.0）的 `cn2t`，參數 `{from:'cn', to:'tw'}`（逐字轉換，不做詞彙替換），**只在查詢含簡體字時延遲載入**（約 450 KB gzip）。

**例外**：若評測選中「轉簡體」的臂（`manifest.model.toSimplified=true`），查詢端每次都需要繁→簡轉換器（`opencc-js/t2cn`），此時它隨模型一起預先下載，並計入首次下載大小上限。

**Rationale**：已驗證用法與大小。`twp` 會做詞彙替換（如自行車→腳踏車），可能把查詢改成經文中沒有的詞，因此只用字元層級轉換（推測，但對和合本比對較安全）。

---

## R7. 前端、PWA 與離線

**Decision**：

| 項目 | 選擇 |
|---|---|
| 建置 | Vite 8.3 |
| PWA | vite-plugin-pwa 1.3（Workbox 7.4） |
| 推論 | `@huggingface/transformers` 4.3（Web Worker、`device: 'wasm'`，WebGPU 為可選加速） |
| UI | Preact（約 4 KB）＋ TypeScript |
| 型別 | TypeScript 6.0（固定 `~6.0.3`，因 typescript-eslint 8.71 不支援 TS 7） |

**離線策略**：
- **Precache**（Service Worker 安裝時）：只放 app shell 與小型資料（經文、段落、關鍵字索引，約 5–10 MB）。
- **模型與向量**：不放 precache（安裝時無進度、一個檔案失敗就整個失敗）；改由 app 以串流 fetch 下載並顯示進度，存入有版本號的 Cache Storage；Workbox 以 `CacheFirst` 規則作為備援。
- 已驗證的關鍵陷阱：transformers.js 預設從 **jsdelivr CDN** 載入 ONNX Runtime 的 WASM → 必須自行託管並設定 `env.backends.onnx.wasm.wasmPaths`；並設定 `env.allowRemoteModels = false`、`env.allowLocalModels = true`、`env.localModelPath`。
- 已驗證：Workbox 預設跳過 >2 MiB 的檔案，且會讓建置失敗 → 需調整 `maximumFileSizeToCacheInBytes` 或改用上述下載策略。
- 已驗證（WebKit）：Safari 每個來源最多可用約 60% 磁碟，但未安裝到主畫面的網站可能被清除 → 成功下載後呼叫 `navigator.storage.persist()`，並讓重新下載容易；UI 提示安裝到主畫面。
- 檔名加內容雜湊，更新時原子替換。

---

## R8. 測試工具與「原則即測試」

**Decision**：

| 層級 | 工具 | 守護的原則／需求 |
|---|---|---|
| 單元 | Vitest 5 | 正規化、出處解析、BM25、RRF、段落聚合、命中判定 |
| 性質測試 | fast-check 4 ＋ `@fast-check/vitest` | 原則 3：BM25、RRF、int8 量化、經節範圍運算的定義性質 |
| 檢索驗收 | Vitest（Node，onnxruntime-node，同一模型檔） | FR-021～024、SC-001 |
| E2E | Playwright 1.63（Chromium） | SC-002 離線、SC-003 不外洩、FR-012／014 措辭 |
| 靜態檢查 | ESLint 10 ＋ typescript-eslint | 原則 4：禁止 `pipeline` 等生成用 import |

**已驗證的陷阱**：
- E2E 必須跑在 `vite build && vite preview`，dev server 不註冊 Service Worker。
- 監看請求要用 `browserContext.on('request')`（才會包含 Service Worker 發出的請求）；在監聽器中不可呼叫 `request.frame()`（對 SW 請求會丟例外）。
- 離線測試不可同時使用 `route()`（會停用 HTTP 快取、干擾 SW）。最強的離線驗證：測試中自行啟動 preview server，暖機後**關掉伺服器**再測。
- 不外洩測試：用獨特查詢（如「以馬內利測試」），比對所有請求的 URL、POST 內容、標頭（含 URL 編碼與簡繁轉換形式）；另外斷言**所有請求都是同源**（可抓到 jsdelivr 與 Hugging Face 的外部請求）。
- transformers.js 的發行檔本身含有 `"text-generation"` 字串（任務登錄表）→ 不能以掃描 bundle 作為「不含生成模型」的測試；改為：ESLint 限制 import、測試掃描 `src/**`、測試 `public/models/` 只含指定的 embedding 模型檔。

**Node 內建 SQLite**：建置腳本以 Node 24 內建的 `node:sqlite` 讀取信望愛資料庫（推測可用，實作時以測試確認；不行則改用 `better-sqlite3`）。
