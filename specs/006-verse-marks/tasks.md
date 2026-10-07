# Tasks：讀者自己的記號

- [ ] T001 `tests/unit/marks.test.ts`（先紅）：切換加上／取消；查詢；序列化與壞資料回空；同一節不重複
- [ ] T002 實作 `src/core/marks.ts`；確認 T001 通過
- [ ] T003 `tests/unit/reader-arrangement.test.ts` 或新測試（先紅）：`scrubTarget` 吸到記號；記號與章刻度同時在附近時取較近者；沒有記號時行為不變
- [ ] T004 實作 `scrubTarget` 的記號參數；確認 T003 通過
- [ ] T005 `e2e/marks.spec.ts`（先紅）：點節號加上／取消；重新整理仍在；版面座標不變；書卷層色條寬度 ≥ 4 像素；進度條上的記號點、拖到記號放開停在該節；經文卡沒有記號
- [ ] T006 `src/ui/reader/marks-store.ts`、精讀層節號點擊與標示、`MarkBars`、進度條記號點；字串；確認 T005 通過
- [ ] T007 全部測試；README；vision 階段 6 勾選；知識回流（草稿〈記號與快速翻找〉的第一步回流並退休）
