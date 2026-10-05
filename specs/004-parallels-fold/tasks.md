# Tasks：串珠（語意近鄰）與原位摺疊比對

- [X] T001 `tests/unit/parallels.test.ts`：合成向量——最相似的段落排第一；排除自身與同章；只回 id 順序（無分數）；k 上限；沒有向量時回空
- [X] T002 實作 `src/core/parallels.ts`；確認 T001 通過
- [X] T003 Worker `parallels` → `parallelsResult`（`tests/unit/worker-protocol.test.ts`、`tests/unit/book.test.ts`）；實作 protocol、engine、client
- [X] T004 `e2e/parallels.spec.ts`（先紅）：開串珠列出不同章段落、無分數；點一筆展開完整經文與「展開全章」；關閉後 data-landing 與相機 transform 不變；方向鍵換段後清單更新
- [X] T005 `src/ui/reader/ParallelsPanel.tsx`、Reader 工具列「串珠」；字串（中性用語，守護測試沿用）；確認 T004 通過
- [X] T006 全部測試；vision 階段 3 第二條成功標準勾選；README
- [ ] T007 待使用者決定資料來源後：第一層「新約引用舊約」匯入（署名、授權檔獨立），見 knowledge/draft/2026-10-05-待使用者決定.md
