# 資料模型：離線混合檢索

**Spec**：[spec.md](./spec.md) ｜ **Research**：[research.md](./research.md)

所有資料在建置時產生、執行時唯讀；使用者的查詢只存在於記憶體中，不寫入任何儲存。檔案格式見 [contracts/data-artifacts.md](./contracts/data-artifacts.md)。

## 實體

### Book（書卷）

| 欄位 | 型別 | 說明／驗證 |
|---|---|---|
| `id` | 1–66 | 正典順序；恰 66 卷（FR-007） |
| `code` | string | 英文代碼（信望愛 `engs`，如 `John`） |
| `short` | string | 中文簡稱（如 `約`、`撒上`） |
| `name` | string | 中文全名（如 `約翰福音`） |
| `testament` | `OT` \| `NT` | 創～瑪為 OT，太～啟為 NT |
| `category` | Category | 見下；每卷恰屬一類（FR-015） |
| `chapterCount` | int ≥ 1 | 由經文資料計算；全書合計 1,189 |

### Category（正典分類）

兩層：`testament` × `category`（FR-015）。

| testament | category | 範圍 |
|---|---|---|
| OT | `law` 律法書 | 創～申 |
| OT | `history` 歷史書 | 書～斯 |
| OT | `wisdom` 詩歌智慧書 | 伯～歌 |
| OT | `prophets` 先知書 | 賽～瑪（含哀） |
| NT | `gospels` 福音書 | 太～約 |
| NT | `history` 歷史書 | 徒 |
| NT | `epistles` 書信 | 羅～猶 |
| NT | `revelation` 啟示 | 啟 |

篩選鍵為 `(testament, category)`，所以舊約歷史書與新約歷史書可分開選取。

### Verse（經節）

| 欄位 | 型別 | 說明／驗證 |
|---|---|---|
| `ref` | VerseRef `{book, chapter, verse}` | 唯一 |
| `display` | string | 顯示用經文：保留「　神」抬頭空白、`─`、譯註（R1） |
| `searchText` | string | 檢索用文字：移除譯者註（以或譯／原文／或作／有古卷開頭的（…）與【…】）、所有括號符號、`─`、「　神」的抬頭空白；經文本身的括號內容（詩篇標題、細拉、旁白、〈…〉）保留；人名間隔點統一為 `‧` |
| `notes` | string[] | 從經文抽出的譯者註（如「（原文是婦人）」「【就是賜平安者】」） |
| `mergedInto` | VerseRef? | 若此節為 `"a"` 佔位，指向承載內容的前一節 |
| `variant` | boolean | 11 節異文經節為 true |

驗證：`searchText` 不得含 `（` `【` `〈` 及 `"a"` 佔位；`mergedInto` 的目標必須是同章前一節。

### Passage（段落）— 結果呈現與命中判定的單位

| 欄位 | 型別 | 說明／驗證 |
|---|---|---|
| `id` | int | 全書唯一、依正典順序遞增 |
| `range` | VerseRange `{start: VerseRef, end: VerseRef}` | 不跨章；`start ≤ end` |
| `book` | Book.id | |
| `segmentation` | string | 分段視角 id；本功能為 `cu89-paragraphs`（新標點和合本分段） |

段落邊界是一種**視角**，不是唯一的事實：不同的神學與釋經判斷會切出不同的段落。資料模型允許多組分段並存，每組以 `segmentation` 區分；本功能只載入一組。

來源：eBible 分段邊界（R2）。規則：
- 段落不跨章；章首一律是段落起點。
- 段落長度上限 `MAX_PASSAGE_VERSES = 12`；超過者（如詩 119）以不重疊的視窗切分。
- 每一節恰屬一個段落（段落為全書的劃分）——性質測試守護。
- **不含標題**（FR-011a）。

### RetrievalUnit（檢索單元）— 內部，不直接呈現

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | int | 對應向量檔的列號 |
| `range` | VerseRange | 依尺度而定 |
| `passageId` | Passage.id | 所屬段落 |
| `scale` | `verse` \| `window` \| `passage` | 多尺度（2026-10-01 加入）：單節（合併節佔位除外）、3 節視窗（段落內滑動、步長 2）、整段（> 3 節的段落才另建，避免與視窗重複） |

語意檢索同時在三種尺度上進行並融合：單節能精準對到一句話的經文（如「應當一無掛慮」），視窗與整段能對到敘事主題。關鍵字檢索在單節上進行。結果再聚合回呈現粒度（見 SearchRequest.granularity）。

### LexiconEntry（詞彙擴充）— 建置時產生

| 欄位 | 型別 | 說明 |
|---|---|---|
| `word` | string | 查詢中可能出現的詞（萌典詞條，或和合本中出現的詞） |
| `expansions` | `{term, via}[]` | 擴充詞；`term` 必須在和合本中實際出現；`via` 為來源：`moedict`（教育部《重編國語辭典修訂本》近義詞）或 `strongs:G3309` 之類（同一原文字的和合本譯法） |

驗證：擴充只有一層辭典近義詞＋一層原文同字，不遞迴；不含任何主題分類（衍生原則 9）。

### Query（查詢）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `raw` | string | 使用者輸入；只存在於記憶體 |
| `normalized` | string | 去除前後空白、簡轉繁（含簡體時）、全半形統一 |
| `reference` | VerseRange? | 若可解析為經文出處（FR-004） |
| `filter` | `{testaments?: Set, categories?: Set<(testament,category)>}` | |
| `granularity` | `verse` \| `passage` \| `chapter` | 呈現粒度，預設 `passage` |
| `expand` | boolean | 是否套用詞彙擴充，預設 true |

驗證：`normalized` 為空（或只有標點）時不搜尋。長度上限 `MAX_QUERY_CHARS = 512`，超過截斷並告知（Edge Cases）。

### SearchResult（搜尋結果）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `rank` | int ≥ 1 | 名次 |
| `passage` | Passage | 顯示範圍 |
| `contextRange` | VerseRange | 前後文範圍：段落前後各延伸 `CONTEXT_VERSES = 2` 節（不跨章） |
| `matchedTerms` | string[] | 查詢中實際出現在段落裡的字詞（供標示，FR-006） |
| `sources` | `('semantic' \| 'keyword' \| 'expansion' \| 'reference')[]` | 命中來源（內部除錯用，UI 不顯示分數） |

驗證（原則 5、6）：不含任何分數欄位給 UI；`passage.range` 至少一節且帶出處；同一 `passage.id` 不重複。

### BenchmarkQuery（固定查詢）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | string | 如 `anxiety-mortgage` |
| `text` | string | 查詢文字 |
| `kind` | `meaning` \| `lament` \| `idol` \| `betrayal` \| `keyword` | |
| `expected` | VerseRange[] | 一個或多個期望範圍 |
| `heldOut` | boolean | true 為保留查詢：只參考、不用於選模型、不列入驗收 |

初始驗收集（`heldOut=false`）即 `knowledge/vision.md` 階段 1 的 7 筆：

| id | text | expected |
|---|---|---|
| `anxiety-mortgage` | 面對房貸壓力很焦慮 | 腓 4:6 |
| `god-far` | 覺得神離我很遠，禱告像打在天花板上 | 詩 88 全章；哀 全卷；伯 全卷 |
| `please-everyone` | 必須討好所有人才能感到安全 | 箴 29:25；加 1:10；帖前 2:4 |
| `close-friend-betrayal` | 被最親近的朋友背叛、出賣 | 詩 55:12–14；詩 41:9 |
| `cana-wedding` | 迦拿的婚宴 | 約 2:1–11 |
| `melchizedek` | 麥基洗德 | 創 14 全章；來 7 全章 |
| `david-goliath` | 大衛擊殺歌利亞 | 撒上 17 全章 |

命中判定（FR-024）：`hit(result, q) ⇔ ∃ e ∈ q.expected: overlaps(result.passage.range, e)`；查詢命中 ⇔ 前 5 名中有任一結果命中。

### EvaluationReport（評測報告）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `dataVersion` | string | 經文與段落資料的內容雜湊 |
| `arms` | Arm[] | 每臂：模型 id、dtype、是否轉簡體、是否加指令、下載大小 |
| `results` | `{armId, queryId, hitAtTop5, bestRank}`[] | `bestRank` 為最佳命中名次（無則為 null） |
| `summary` | `{armId, hits, meanBestRank, heldOutHits, sizeBytes}`[] | |
| `selected` | armId | 依 research R3 的選擇規則 |

驗證：同一輸入重跑，報告逐位元相同（FR-022）——報告中不含時間戳記等非決定性欄位。

## 狀態轉換：應用程式載入

```text
未安裝 ──(首次開啟、有網路)──▶ 下載 shell 與經文資料 ──▶ 關鍵字可用
   │                                                   │
   │                                     (背景下載模型與向量，顯示進度)
   │                                                   ▼
   │                                          語意可用＝完全就緒（可離線）
   │                                                   │
   └─(首次開啟、無網路)──▶ 顯示「需先連網下載一次」     (儲存被清除) ──▶ 回到「未安裝」
```

- 「關鍵字可用」狀態下，搜尋只用字詞比對，UI 標示「語意搜尋準備中」（FR-020）；模型就緒後，若畫面上有查詢則自動以混合檢索更新。
