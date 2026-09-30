# 契約：檢索 API（核心模組與 Worker 訊息）

核心檢索邏輯是純 TypeScript 模組（`src/core/`），可在 Node（測試、評測）與瀏覽器 Worker 中執行；UI 只透過 Worker 訊息使用它。實體定義見 [data-model.md](../data-model.md)。

## 1. 核心函式（`src/core/`）

```ts
// 查詢正規化與出處解析
normalizeQuery(raw: string, opts?: { toTraditional?: (s: string) => string }): NormalizedQuery
parseReference(text: string, books: Book[]): VerseRange | null     // "羅 8:28"、"羅馬書8章28節"、"羅8:28-30"

// 關鍵字（字元 bigram + unigram BM25）
tokenize(text: string): string[]                                   // 回傳 unigram 與 bigram
bm25Search(index: KeywordIndex, query: string, topK: number): Ranked<UnitId>[]

// 語意
dotInt8(query: Float32Array, vectors: Int8Array, scales: Float32Array, dim: number): Float32Array
semanticSearch(queryVec: Float32Array, store: VectorStore, topK: number): Ranked<UnitId>[]

// 融合與聚合
rrf(lists: Ranked<UnitId>[][], k?: number /* 60 */): Ranked<UnitId>[]
aggregateToPassages(units: Ranked<UnitId>[], unitToPassage: Int32Array): Ranked<PassageId>[]

// 組裝結果
search(req: SearchRequest, deps: SearchDeps): SearchResponse
```

### 行為保證（皆有測試）

| 保證 | 測試類型 |
|---|---|
| `bm25Search`：與段落無任何共同 token 時分數為 0、不出現在結果 | 性質 |
| `bm25Search`：含完整查詢字串的單元，分數 ≥ 只含部分 token 的單元（同長度下） | 性質 |
| `rrf`：結果中每個 id 唯一；某 id 在任一輸入清單的名次提前，其融合名次不會變差 | 性質 |
| `aggregateToPassages`：輸出的 passage id 唯一；名次由該段落最高分的單元決定 | 性質 |
| `dotInt8`：與 float32 內積的誤差在量化誤差上界內 | 性質 |
| `parseReference`：66 卷的全名與簡稱都能解析；不合法章節回傳 null | 單元 |
| `search`：出處查詢時，該段落為第 1 名（FR-004） | 單元 |
| `search`：語意尚未就緒時只用關鍵字，且 `response.semanticReady=false`（FR-020） | 單元 |
| `search`：結果不含分數欄位（原則 6） | 型別＋單元 |

## 2. SearchRequest / SearchResponse

```ts
interface SearchRequest {
  query: string;                       // 原始輸入
  filter?: { testaments?: Testament[]; categories?: [Testament, Category][] };
  offset?: number;                     // 預設 0
  limit?: number;                      // 預設 10（FR-003）
}

interface SearchResponse {
  results: SearchResult[];             // 見 data-model；無分數
  total: number;                       // 篩選後總數
  counts: {                            // 篩選前，各約與各類別的結果數（FR-016）
    testament: Record<Testament, number>;
    category: Record<`${Testament}:${Category}`, number>;
  };
  semanticReady: boolean;              // FR-020
  truncated: boolean;                  // 查詢超過長度上限
  reference: VerseRange | null;        // 若輸入被解析為出處
}
```

## 3. Worker 訊息協定（`src/worker/search.worker.ts`）

所有訊息同源、在裝置內傳遞；Worker **不得**發出任何網路請求，除了向同源讀取 `/models/`、`/data/`、`/ort/` 靜態檔（首次下載）。

| 方向 | `type` | 內容 |
|---|---|---|
| UI → Worker | `init` | `{ manifestUrl }` |
| Worker → UI | `progress` | `{ phase: 'text' \| 'model' \| 'vectors', loaded, total }` |
| Worker → UI | `ready` | `{ keyword: true, semantic: boolean }` |
| UI → Worker | `search` | `{ id, request: SearchRequest }` |
| Worker → UI | `result` | `{ id, response: SearchResponse }` |
| UI → Worker | `chapter` | `{ id, book, chapter }` |
| Worker → UI | `chapterResult` | `{ id, verses: Verse[], passages: Passage[] }` |
| Worker → UI | `error` | `{ id?, code: 'NOT_DOWNLOADED' \| 'QUOTA' \| 'CORRUPT' \| 'INTERNAL', message }` |

`message` 為固定的中性介面文字，不含任何生成內容。

## 4. UI 文字契約（原則 4、6）

- 結果清單標題：「可能相關的段落」。
- 允許出現在畫面上的文字：經文（`display`、`notes`）、使用者輸入、`src/ui/strings.ts` 中的固定介面字串。
- `src/ui/strings.ts` MUST NOT 含：「最佳」「推薦」「最正確」「答案」「解釋」「建議」——由單元測試掃描守護。
- 不顯示數值分數。
