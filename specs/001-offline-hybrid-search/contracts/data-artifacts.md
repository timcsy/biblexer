# 契約：建置產物（資料檔格式）

建置腳本（`scripts/`）產生、app 與評測程式讀取。所有檔名含內容雜湊，由 `manifest.json` 指向；原始下載檔與產物不進 git（由 `npm run build:data` 重建）。

## 輸入（建置時下載，核對雜湊）

| 來源 | 位置 | 核對 |
|---|---|---|
| 信望愛 `bible_little.zip` | `http://ftp.fhl.net/FHL/COBS/data/bible_little.zip` | sha1（寫死在 `scripts/sources.json`） |
| eBible 新標點和合本（神版）USFM | `https://ebible.org/Scriptures/cmn-cu89s_usfm.zip` | sha256 |
| Embedding 模型 | Hugging Face 指定 repo 與 **固定 revision** | 每個檔案 sha256 |
| ONNX Runtime WASM | `node_modules/onnxruntime-web/dist/` 複製 | 版本與 `@huggingface/transformers` 相依一致 |

`scripts/sources.json` 同時列出每個來源用了什麼（例：eBible 只用分段邊界，不用任何文字），作為與信望愛說明時的清單。

## 輸出（`public/data/`、`public/models/`、`public/ort/`）

### `data/manifest.json`

```json
{
  "schema": 1,
  "dataVersion": "<經文+段落內容雜湊>",
  "segmentation": { "id": "cu89-paragraphs", "source": "eBible cmn-cu89s \\p \\b \\m markers (boundaries only)" },
  "model": { "id": "Xenova/bge-small-zh-v1.5", "revision": "<sha>", "dtype": "q8",
             "dim": 512, "pooling": "cls", "queryPrefix": "", "toSimplified": false },
  "files": {
    "books":    { "path": "books.<hash>.json",    "bytes": 0 },
    "verses":   { "path": "verses.<hash>.json",   "bytes": 0 },
    "passages": { "path": "passages.<hash>.bin",  "bytes": 0 },
    "units":    { "path": "units.<hash>.bin",     "bytes": 0 },
    "keyword":  { "path": "keyword.<hash>.bin",   "bytes": 0 },
    "vectors":  { "path": "vectors.<hash>.bin",   "bytes": 0 }
  },
  "sources": ["FHL unv (bible_little.zip sha1 …)", "eBible cmn-cu89s paragraph boundaries only"]
}
```

`model` 區塊由評測選出的臂決定；app 以它設定查詢端（前綴、是否轉簡體、pooling），確保與建置端一致。

### `books.json`

`Book[]`（見 data-model），66 筆。

### `verses.json`

依正典順序的陣列：`[bookId, chapter, verse, display, notes[], flags]`；`flags` 位元：1=merged 佔位、2=variant。`searchText` 不存（由 `display` 以同一函式在 Worker 啟動時重算——同一函式同時用於建置與執行時，由單元測試保證一致）。

### `passages.bin` / `units.bin`

小端序 `Int32Array`：
- passages：每段 `[startVerseIdx, endVerseIdx]`（`verseIdx` 為 verses 陣列索引）。
- units：每單元 `[startVerseIdx, endVerseIdx, passageId, scale]`；`scale`：0＝單節、1＝3 節視窗、2＝整段（R10）。

### `lexicon.json`

詞彙擴充表（R9）：`{ "焦慮": [["憂慮", "moedict"], ["掛慮", "strongs:G3309"], …], … }`。只收錄擴充詞在和合本中出現的條目。來源：萌典 `dict-revised.json.xz`（教育部，CC BY-ND 3.0 TW，只取近義關係）與信望愛 `unv` 的 Strong's 標記（只用於分組）。

### `keyword.bin`

BM25 倒排索引（建立在**單節**單元上）：
- 標頭：`numUnits, numTerms, avgLen, k1, b`
- `termDict`：排序的 token 字串（UTF-8）與偏移
- `postings`：每 token 的 `(unitId, tf)` 串列（`Uint32`/`Uint16`）
- `unitLen`：`Uint16Array`

### `vectors.bin`

- 標頭：`numUnits (u32), dim (u32)`
- `scales`：`Float32Array[numUnits]`
- `data`：`Int8Array[numUnits × dim]`（每向量已 L2 正規化後量化：`q = round(v / scale)`，`scale = max|v| / 127`）

### `models/<model-id>/`

鏡像 Hugging Face repo 版面：`config.json`、`tokenizer.json`、`tokenizer_config.json`、`onnx/model_quantized.onnx`。只允許 manifest 指定的那一個模型（測試守護：原則 4）。

### `ort/`

自行託管的 onnxruntime-web `.wasm` / `.mjs`；app 設定 `env.backends.onnx.wasm.wasmPaths = '/ort/'`。
