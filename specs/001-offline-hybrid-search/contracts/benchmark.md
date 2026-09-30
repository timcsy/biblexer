# 契約：評測（FR-021～024）

## 指令

```bash
npm run bench                 # 對 bench/arms.json 的全部臂執行評測，輸出報告
npm run bench -- --arm <id>   # 只跑單一臂
npm test -- acceptance        # 驗收：以 manifest 選定的臂跑 7 個固定查詢，須 7/7
```

## `bench/queries.json`

```json
[
  { "id": "anxiety-mortgage", "text": "面對房貸壓力很焦慮", "kind": "meaning",
    "expected": [{ "start": "Phil 4:6", "end": "Phil 4:6" }], "heldOut": false }
]
```

- `heldOut: false` 的 7 筆與 `knowledge/vision.md` 階段 1 一致；修改須同步 vision。
- `heldOut: true` 的保留查詢只供參考，不影響選擇與驗收。
- 經文出處以信望愛 `engs` 代碼 + `章:節` 表示。

## `bench/arms.json`

```json
[
  { "id": "bge-small-trad",       "model": "Xenova/bge-small-zh-v1.5", "revision": "<sha>", "dtype": "q8",
    "pooling": "cls",  "queryPrefix": "", "toSimplified": false },
  { "id": "bge-small-trad-instr", "model": "Xenova/bge-small-zh-v1.5", "revision": "<sha>", "dtype": "q8",
    "pooling": "cls",  "queryPrefix": "为这个句子生成表示以用于检索相关文章：", "toSimplified": false }
]
```

每個臂在檢索時都使用完整的混合檢索（語意 + 關鍵字 + RRF + 段落聚合），因為驗收的是使用者實際看到的結果。

## 報告：`bench/report.json` 與 `bench/report.md`

欄位見 data-model 的 EvaluationReport。`report.md` 為人讀的表格：列 = 臂，欄 = 每個查詢的最佳名次（未進前 5 標示 ✗），最後為命中數、平均最佳名次、下載大小、是否符合大小上限、是否被選中。

## 規則

- 決定性：同一輸入重跑，`report.json` 逐位元相同（不含時間戳記；排序同分時以 id 決勝）。
- 選擇規則（research R3）：大小 ≤ 200 MB → 命中數最高 → 平均最佳名次 → 較小者。
- 驗收：選定臂的 7 個固定查詢命中數 MUST = 7；任何檢索相關改動後命中數 MUST NOT 下降。
